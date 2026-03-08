#!/usr/bin/env python3
"""
binary2048_pipeline.py — Binary-2048 ML training pipeline

Four phases that can be run independently or chained:

    python binary2048_pipeline.py --phase collect  # gather self-play experience
    python binary2048_pipeline.py --phase train    # train a DQN on that experience
    python binary2048_pipeline.py --phase submit   # evaluate the trained agent
    python binary2048_pipeline.py --phase export   # export data to CSV / Parquet
    python binary2048_pipeline.py --phase all      # run collect → train → submit

BACKGROUND FOR NEW ML PRACTITIONERS
=====================================
Reinforcement learning (RL) works by letting an agent play a game many times
and rewarding it for good outcomes. Here we use a Deep Q-Network (DQN), which
is a neural network that estimates "how good will my future score be if I take
action A from state S?" For each board position the network outputs 4 numbers —
one Q-value per direction (L, R, U, D). We pick the highest legal Q-value.

The training loop:
  1. Agent plays a game, storing every (state, action, reward, next_state, done)
     tuple in a "replay buffer" — a big list of past experiences.
  2. Every N steps we sample a random mini-batch from the buffer and train the
     network to predict better Q-values.
  3. "Action masking" ensures the agent never considers illegal moves (those that
     would leave the board unchanged).

DEPENDENCIES
============
Required:
    pip install requests numpy

Optional (for PyTorch DQN — falls back to numpy-only if absent):
    pip install torch

Optional (for export phase Parquet output):
    pip install pandas pyarrow
"""

from __future__ import annotations

import argparse
import json
import math
import os
import pickle
import random
import sys
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional, Tuple

import numpy as np
import requests

# ---------------------------------------------------------------------------
# Dependency probes
# ---------------------------------------------------------------------------

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

try:
    import pyarrow  # noqa: F401 — checked but not called directly
    PYARROW_AVAILABLE = True
except ImportError:
    PYARROW_AVAILABLE = False

# ---------------------------------------------------------------------------
# Type aliases
# Types used throughout — these are plain Python, not RL jargon:
#   State       — numpy array of shape (state_dim,)
#   ActionMask  — numpy array of shape (4,), values 0.0 or 1.0
#   Transition  — one (s, a, r, s', done, mask) experience tuple
# ---------------------------------------------------------------------------

State = np.ndarray          # shape (state_dim,)
ActionMask = np.ndarray     # shape (4,)
Transition = Tuple[State, int, float, State, bool, ActionMask]

# Action space aligned to the server's ACTION_SPACE = ["L", "R", "U", "D"]
ACTION_DIRS = ["left", "right", "up", "down"]
ACTION_CODES = ["L", "R", "U", "D"]

# ---------------------------------------------------------------------------
# GameClient — thin HTTP wrapper around the Binary-2048 REST API
# ---------------------------------------------------------------------------

class GameClient:
    """
    Wraps the Binary-2048 game server HTTP API.

    All public methods either return the decoded JSON dict or raise an
    exception with a human-readable message.

    The server must be running at `base_url`. Start it with:
        npm run dev   (in the project root)
    """

    def __init__(self, base_url: str = "http://localhost:3000", timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()

    def _get(self, path: str, **params: Any) -> Dict:
        url = f"{self.base_url}{path}"
        resp = self._session.get(url, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, body: Dict) -> Dict:
        url = f"{self.base_url}{path}"
        resp = self._session.post(url, json=body, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # Game lifecycle
    # ------------------------------------------------------------------

    def create_game(self, seed: Optional[int] = None) -> Dict:
        """
        POST /api/games

        Returns the game creation response including `id` and `current` state.
        Pass `seed` for a deterministic starting board — same seed always gives
        the same initial tile layout.
        """
        body: Dict = {}
        if seed is not None:
            body["config"] = {"seed": seed}
        return self._post("/api/games", body)

    def get_encoded(self, game_id: str) -> Dict:
        """
        GET /api/games/:id/encoded

        Returns the AI-friendly state representation:
            encodedFlat  — 32-element list [type0, val0, type1, val1, ...]
            actionMask   — 4-element list aligned to ["L","R","U","D"]
            stateHash    — deterministic hash of current board
            legalMoves   — human-readable legal direction names
        """
        return self._get(f"/api/games/{game_id}/encoded")

    def move(self, game_id: str, direction: str) -> Dict:
        """
        POST /api/games/:id/move

        `direction` is one of: "up", "down", "left", "right"

        Returns:
            reward  — score delta (how much the score increased)
            done    — True if game is over or won
            changed — False if the move was a no-op (board unchanged)
        """
        return self._post(f"/api/games/{game_id}/move", {"dir": direction})

    # ------------------------------------------------------------------
    # Batch simulation (used for MCTS rollouts)
    # ------------------------------------------------------------------

    def simulate(
        self,
        moves: List[str],
        seed: Optional[int] = None,
        include_steps: bool = False,
    ) -> Dict:
        """
        POST /api/simulate

        Runs `moves` on a fresh game (with optional `seed`) in one HTTP call,
        without persisting any state. Returns final score and encoded state.

        This is the key primitive for MCTS-lite: to estimate how good a board
        position is, we play random moves for N steps and average the scores.

        `moves` is a list of direction strings or action codes.
        """
        body: Dict = {"moves": moves, "includeSteps": include_steps}
        if seed is not None:
            body["seed"] = seed
        return self._post("/api/simulate", body)

    # ------------------------------------------------------------------
    # Training data API
    # ------------------------------------------------------------------

    def get_training_replays(
        self,
        page: int = 1,
        limit: int = 20,
        bot: str = "rollout",
        min_score: int = 0,
    ) -> Dict:
        """GET /api/training/replays — paginated deterministic replay records."""
        return self._get(
            "/api/training/replays",
            page=page,
            limit=limit,
            bot=bot,
            minScore=min_score,
        )

    def get_training_labels(
        self,
        page: int = 1,
        limit: int = 100,
        strategy: str = "score_delta",
        min_tile: int = 0,
    ) -> Dict:
        """GET /api/training/labels — per-step (state, best_action) tuples."""
        return self._get(
            "/api/training/labels",
            page=page,
            limit=limit,
            strategy=strategy,
            minTile=min_tile,
        )

    def health(self) -> bool:
        """Returns True if the server is reachable."""
        try:
            self._get("/api/health")
            return True
        except Exception:
            return False


# ---------------------------------------------------------------------------
# State utilities
# ---------------------------------------------------------------------------

def flat_state_to_array(flat: List[float], state_dim: int = 32) -> State:
    """
    Convert the server's `encodedFlat` list to a numpy array.

    If state_dim == 32 (default): use the 32 raw floats directly.
    If state_dim == 256: expand into a one-hot encoding where each cell's
    value is bucketed into 16 bins (log2 tile 0–15), producing a richer
    feature vector. This helps the network distinguish tile magnitudes more
    clearly but is slower to compute.

    PAPER NOTE: The 32-dim raw encoding omits tile-magnitude discrimination
    between e.g. tile=8 (value≈3.0) and tile=16 (value≈4.0) in a linear layer,
    because the difference is just 1 unit. The 256-dim one-hot puts each tile
    value in a separate neuron, giving the network an unambiguous signal.
    """
    arr = np.array(flat, dtype=np.float32)

    if state_dim == 32:
        # Fast path: return as-is.
        return arr

    if state_dim == 256:
        # One-hot expansion: ignore `type` channel, bucket `value` into 16 bins.
        # arr layout: [type0, val0, type1, val1, ...] for 16 cells = 32 elements.
        # We take every other element starting at index 1 (the value channel).
        values = arr[1::2]  # shape (16,)
        out = np.zeros(256, dtype=np.float32)
        for i, v in enumerate(values):
            bucket = min(15, int(round(v)))  # log2 tile, clamped to 0–15
            out[i * 16 + bucket] = 1.0
        return out

    # Fallback: just use raw 32-dim.
    return arr[:32]


def action_mask_to_array(mask: List[int]) -> ActionMask:
    """Convert the server's actionMask list to a float numpy array."""
    return np.array(mask, dtype=np.float32)


# ---------------------------------------------------------------------------
# ReplayBuffer — experience pool for DQN training
# ---------------------------------------------------------------------------

class ReplayBuffer:
    """
    Stores (state, action, reward, next_state, done, action_mask) tuples.

    During training we sample random mini-batches from this buffer rather
    than training on sequential game experience. This is called "experience
    replay" and is crucial for stable DQN training — sequential transitions
    are highly correlated, which confuses gradient descent.

    The buffer is a fixed-size circular queue (deque). When full, old
    transitions are automatically discarded.
    """

    def __init__(self, capacity: int = 50_000):
        self.buf: Deque[Transition] = deque(maxlen=capacity)

    def push(self, s: State, a: int, r: float, s2: State, done: bool, mask: ActionMask) -> None:
        self.buf.append((s, a, r, s2, done, mask))

    def sample(self, batch_size: int) -> List[Transition]:
        return random.sample(list(self.buf), batch_size)

    def __len__(self) -> int:
        return len(self.buf)

    def save(self, path: str) -> None:
        with open(path, "wb") as f:
            pickle.dump(self.buf, f)
        print(f"[buffer] saved {len(self.buf)} transitions → {path}")

    def load(self, path: str) -> None:
        with open(path, "rb") as f:
            self.buf = pickle.load(f)
        print(f"[buffer] loaded {len(self.buf)} transitions ← {path}")


# ---------------------------------------------------------------------------
# Neural network (PyTorch)
# ---------------------------------------------------------------------------

if TORCH_AVAILABLE:
    class DQNNet(nn.Module):
        """
        A simple 3-layer fully connected Q-network.

        Input:  state vector (32 or 256 floats)
        Output: Q-values for 4 actions [L, R, U, D]

        The network is small enough to train on CPU in reasonable time.
        A GPU speeds up training ~10x if available.

        PAPER NOTE: This architecture (3 FC layers, ReLU activations) is a
        standard DQN baseline. For Binary-2048 specifically, a convolutional
        architecture (treating the 4x4 grid as a spatial feature map) may
        perform better, as it can learn local merge patterns. This is left
        as future work.
        """
        def __init__(self, state_dim: int, hidden_dim: int = 128):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(state_dim, hidden_dim),
                nn.ReLU(),
                nn.Linear(hidden_dim, hidden_dim),
                nn.ReLU(),
                nn.Linear(hidden_dim, 4),
            )

        def forward(self, x: "torch.Tensor") -> "torch.Tensor":
            return self.net(x)


class DQNAgent:
    """
    Deep Q-Network agent (requires PyTorch).

    Training algorithm: DQN with experience replay and a target network.

    TARGET NETWORK: We keep two copies of the network (online and target).
    The online net is updated every step. The target net is only updated
    every `target_update_steps` steps. This stabilises training because
    the Q-target values don't shift on every step.

    ACTION MASKING: Before picking an action or computing the max Q-value
    for a next state, we set Q[illegal] = -1e9. This prevents the agent
    from ever choosing a move that would be a no-op on the real board.
    """

    def __init__(
        self,
        state_dim: int = 32,
        hidden_dim: int = 128,
        lr: float = 1e-4,
        gamma: float = 0.99,
        device: Optional[str] = None,
    ):
        if not TORCH_AVAILABLE:
            raise RuntimeError("PyTorch is not installed. Use DQNAgentNumpy instead.")

        self.state_dim = state_dim
        self.gamma = gamma
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        print(f"[agent] using device: {self.device}")

        self.online = DQNNet(state_dim, hidden_dim).to(self.device)
        self.target = DQNNet(state_dim, hidden_dim).to(self.device)
        self.target.load_state_dict(self.online.state_dict())
        self.target.eval()

        self.optimizer = optim.Adam(self.online.parameters(), lr=lr)
        self.loss_fn = nn.SmoothL1Loss()  # Huber loss — more stable than MSE

    def act(self, state: State, mask: ActionMask, epsilon: float = 0.0) -> int:
        """
        Pick an action using epsilon-greedy policy.

        With probability `epsilon` we pick a random legal action (exploration).
        Otherwise we pick the action with the highest masked Q-value (exploitation).

        Epsilon starts high (lots of random exploration) and decays over training
        so the agent eventually converges on its learned policy.
        """
        legal = [i for i, m in enumerate(mask) if m > 0]
        if not legal:
            return 0

        if random.random() < epsilon:
            return random.choice(legal)

        with torch.no_grad():
            s = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            q = self.online(s).squeeze(0).cpu().numpy()

        # Mask illegal actions to -infinity before argmax.
        masked_q = q.copy()
        for i in range(4):
            if mask[i] == 0:
                masked_q[i] = -1e9

        return int(np.argmax(masked_q))

    def train_step(self, batch: List[Transition]) -> float:
        """
        One gradient update on a mini-batch of transitions.

        Returns the training loss (useful for monitoring convergence).

        The DQN loss for one transition is:
            target = r + γ * max_a'[ Q_target(s', a') * mask(a') ]    if not done
            target = r                                                  if done
            loss   = HuberLoss( Q_online(s, a),  target )
        """
        states, actions, rewards, next_states, dones, next_masks = zip(*batch)

        states_t = torch.FloatTensor(np.array(states)).to(self.device)
        actions_t = torch.LongTensor(actions).to(self.device)
        rewards_t = torch.FloatTensor(rewards).to(self.device)
        next_states_t = torch.FloatTensor(np.array(next_states)).to(self.device)
        dones_t = torch.FloatTensor([float(d) for d in dones]).to(self.device)
        next_masks_t = torch.FloatTensor(np.array(next_masks)).to(self.device)

        # Current Q-values for the actions actually taken.
        q_vals = self.online(states_t).gather(1, actions_t.unsqueeze(1)).squeeze(1)

        with torch.no_grad():
            # Target Q-values: mask illegal next actions then take max.
            next_q = self.target(next_states_t)
            next_q = next_q + (next_masks_t - 1) * 1e9  # illegal → -1e9
            max_next_q = next_q.max(dim=1).values
            targets = rewards_t + self.gamma * max_next_q * (1 - dones_t)

        loss = self.loss_fn(q_vals, targets)
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.online.parameters(), 1.0)
        self.optimizer.step()
        return float(loss.item())

    def update_target(self) -> None:
        """Copy online network weights to the target network."""
        self.target.load_state_dict(self.online.state_dict())

    def save(self, path: str) -> None:
        torch.save({
            "online": self.online.state_dict(),
            "target": self.target.state_dict(),
            "state_dim": self.state_dim,
        }, path)
        print(f"[agent] saved model → {path}")

    def load(self, path: str) -> None:
        data = torch.load(path, map_location=self.device)
        self.online.load_state_dict(data["online"])
        self.target.load_state_dict(data["target"])
        self.online.eval()
        print(f"[agent] loaded model ← {path}")


# ---------------------------------------------------------------------------
# Numpy fallback agent (no PyTorch required)
# ---------------------------------------------------------------------------

class DQNAgentNumpy:
    """
    Minimal DQN agent using only numpy.

    Uses a 3-layer network with hand-written forward pass and manual gradient
    descent (backpropagation). This is significantly slower and less stable
    than the PyTorch version but requires zero additional dependencies.

    PAPER NOTE: This implementation uses vanilla SGD with a fixed learning
    rate and no momentum. For serious experiments, prefer the PyTorch agent.
    """

    def __init__(
        self,
        state_dim: int = 32,
        hidden_dim: int = 128,
        lr: float = 1e-4,
        gamma: float = 0.99,
    ):
        self.state_dim = state_dim
        self.hidden_dim = hidden_dim
        self.lr = lr
        self.gamma = gamma

        # Xavier initialisation — keeps variance stable across layers.
        scale1 = math.sqrt(2.0 / state_dim)
        scale2 = math.sqrt(2.0 / hidden_dim)
        self.W1 = np.random.randn(state_dim, hidden_dim).astype(np.float32) * scale1
        self.b1 = np.zeros(hidden_dim, dtype=np.float32)
        self.W2 = np.random.randn(hidden_dim, hidden_dim).astype(np.float32) * scale2
        self.b2 = np.zeros(hidden_dim, dtype=np.float32)
        self.W3 = np.random.randn(hidden_dim, 4).astype(np.float32) * scale2
        self.b3 = np.zeros(4, dtype=np.float32)

        # Target network is a separate copy of the weights.
        self._copy_to_target()

    def _copy_to_target(self) -> None:
        self.tW1, self.tb1 = self.W1.copy(), self.b1.copy()
        self.tW2, self.tb2 = self.W2.copy(), self.b2.copy()
        self.tW3, self.tb3 = self.W3.copy(), self.b3.copy()

    def _forward(self, x: np.ndarray, use_target: bool = False) -> np.ndarray:
        W1, b1 = (self.tW1, self.tb1) if use_target else (self.W1, self.b1)
        W2, b2 = (self.tW2, self.tb2) if use_target else (self.W2, self.b2)
        W3, b3 = (self.tW3, self.tb3) if use_target else (self.W3, self.b3)
        h1 = np.maximum(0, x @ W1 + b1)
        h2 = np.maximum(0, h1 @ W2 + b2)
        return h2 @ W3 + b3

    def act(self, state: State, mask: ActionMask, epsilon: float = 0.0) -> int:
        legal = [i for i, m in enumerate(mask) if m > 0]
        if not legal:
            return 0
        if random.random() < epsilon:
            return random.choice(legal)
        q = self._forward(state.reshape(1, -1))[0]
        masked_q = q.copy()
        for i in range(4):
            if mask[i] == 0:
                masked_q[i] = -1e9
        return int(np.argmax(masked_q))

    def train_step(self, batch: List[Transition]) -> float:
        """Manual backprop through 3-layer network. Returns mean Huber loss."""
        total_loss = 0.0
        for s, a, r, s2, done, mask2 in batch:
            # Forward pass (online).
            h1_in = s.reshape(1, -1) @ self.W1 + self.b1
            h1 = np.maximum(0, h1_in)
            h2_in = h1 @ self.W2 + self.b2
            h2 = np.maximum(0, h2_in)
            q = (h2 @ self.W3 + self.b3)[0]

            # Target Q-value.
            q2 = self._forward(s2.reshape(1, -1), use_target=True)[0]
            for i in range(4):
                if mask2[i] == 0:
                    q2[i] = -1e9
            target_q = q.copy()
            target_q[a] = r if done else r + self.gamma * float(q2.max())

            # Huber loss gradient for the taken action only.
            diff = q[a] - target_q[a]
            if abs(diff) <= 1.0:
                grad_out = np.zeros(4, dtype=np.float32)
                grad_out[a] = diff
            else:
                grad_out = np.zeros(4, dtype=np.float32)
                grad_out[a] = np.sign(diff)

            total_loss += 0.5 * min(diff**2, abs(diff))

            # Backprop through layer 3.
            dW3 = h2.T @ grad_out.reshape(1, -1)
            db3 = grad_out
            dh2 = grad_out.reshape(1, -1) @ self.W3.T

            # Backprop through layer 2 (ReLU gate).
            dh2_pre = dh2 * (h2_in > 0)
            dW2 = h1.T @ dh2_pre
            db2 = dh2_pre[0]
            dh1 = dh2_pre @ self.W2.T

            # Backprop through layer 1 (ReLU gate).
            dh1_pre = dh1 * (h1_in > 0)
            dW1 = s.reshape(-1, 1) @ dh1_pre
            db1 = dh1_pre[0]

            # SGD update.
            self.W3 -= self.lr * dW3
            self.b3 -= self.lr * db3
            self.W2 -= self.lr * dW2
            self.b2 -= self.lr * db2
            self.W1 -= self.lr * dW1
            self.b1 -= self.lr * db1

        return total_loss / len(batch)

    def update_target(self) -> None:
        self._copy_to_target()

    def save(self, path: str) -> None:
        data = {
            "W1": self.W1, "b1": self.b1,
            "W2": self.W2, "b2": self.b2,
            "W3": self.W3, "b3": self.b3,
            "state_dim": self.state_dim,
        }
        with open(path, "wb") as f:
            pickle.dump(data, f)
        print(f"[agent] saved numpy model → {path}")

    def load(self, path: str) -> None:
        with open(path, "rb") as f:
            data = pickle.load(f)
        self.W1, self.b1 = data["W1"], data["b1"]
        self.W2, self.b2 = data["W2"], data["b2"]
        self.W3, self.b3 = data["W3"], data["b3"]
        self._copy_to_target()
        print(f"[agent] loaded numpy model ← {path}")


# ---------------------------------------------------------------------------
# Bot policies (used during collect phase without training)
# ---------------------------------------------------------------------------

def priority_bot(mask: ActionMask) -> int:
    """
    Simple reference bot: always tries U > L > R > D.
    Mirrors the server-side 'priority' bot for direct comparison.
    """
    preferred = [2, 0, 1, 3]  # indices into [L, R, U, D]: U=2, L=0, R=1, D=3
    for i in preferred:
        if mask[i] > 0:
            return i
    return int(np.argmax(mask))


def random_bot(mask: ActionMask) -> int:
    """Picks uniformly at random from legal moves."""
    legal = [i for i, m in enumerate(mask) if m > 0]
    return random.choice(legal) if legal else 0


def mcts_bot(
    client: GameClient,
    game_id: str,
    current_seed: int,
    mask: ActionMask,
    n_sims: int = 20,
    rollout_depth: int = 30,
) -> int:
    """
    MCTS-lite: for each legal action, run `n_sims` random rollouts via
    POST /api/simulate and return the action with the highest average
    terminal score.

    WHY USE /api/simulate? The simulate endpoint runs the game engine
    server-side without persisting any state, so we can call it many times
    per move without side effects on the live game.

    PAPER NOTE: This is a bandit-style Monte Carlo policy, not a full MCTS
    with a tree. Full MCTS would require visiting each subtree node multiple
    times and back-propagating UCB1 scores. For Binary-2048 the simpler
    rollout average works well in practice.
    """
    legal = [i for i, m in enumerate(mask) if m > 0]
    if not legal:
        return 0

    best_action = legal[0]
    best_score = -1.0

    for action_idx in legal:
        total_score = 0.0
        first_move = ACTION_DIRS[action_idx]

        for sim in range(n_sims):
            # Construct a move sequence: the candidate first move, then
            # `rollout_depth` random subsequent moves.
            rand_moves = [random.choice(ACTION_DIRS) for _ in range(rollout_depth)]
            moves_seq = [first_move] + rand_moves

            try:
                result = client.simulate(moves_seq, seed=current_seed)
                total_score += result.get("totalScore", 0)
            except Exception:
                # If the simulate endpoint is rate-limited or fails, fall back
                # to the random bot for this action.
                total_score += 0

        avg = total_score / n_sims
        if avg > best_score:
            best_score = avg
            best_action = action_idx

    return best_action


# ---------------------------------------------------------------------------
# Phase 1: Collect
# ---------------------------------------------------------------------------

def collect_phase(args: argparse.Namespace, client: GameClient, buffer: ReplayBuffer) -> None:
    """
    Self-play data collection.

    Plays `collect_games` games using the configured policy, storing every
    (state, action, reward, next_state, done, action_mask) transition in the
    replay buffer.

    COLLECT MODES:
        mcts     — uses MCTS-lite via /api/simulate (best quality, slower)
        priority — always plays U>L>R>D (fast, low quality)
        random   — uniform random from legal moves (fast, very low quality)

    Higher-quality collection data = better-trained agent. MCTS-lite data is
    strongly preferred if the simulate endpoint is accessible.
    """
    print(f"\n[collect] starting {args.collect_games} games, mode={args.collect_mode}")

    scores: List[float] = []
    max_tiles: List[int] = []

    for game_num in range(1, args.collect_games + 1):
        seed = random.randint(1, 2_147_483_647)

        try:
            game_resp = client.create_game(seed=seed)
        except Exception as e:
            print(f"[collect] game {game_num}: create_game failed: {e}")
            continue

        game_id = game_resp["id"]
        current_seed = game_resp["current"]["seed"]

        episode_score = 0.0
        episode_max_tile = 0
        step = 0

        try:
            enc = client.get_encoded(game_id)
        except Exception as e:
            print(f"[collect] game {game_num}: get_encoded failed: {e}")
            continue

        state = flat_state_to_array(enc["encodedFlat"], args.state_dim)
        mask = action_mask_to_array(enc["actionMask"])

        while True:
            # Pick action based on collect mode.
            if args.collect_mode == "mcts":
                action = mcts_bot(client, game_id, current_seed, mask, args.mcts_sims)
            elif args.collect_mode == "priority":
                action = priority_bot(mask)
            else:
                action = random_bot(mask)

            direction = ACTION_DIRS[action]

            try:
                move_resp = client.move(game_id, direction)
            except Exception as e:
                print(f"[collect] game {game_num} step {step}: move failed: {e}")
                break

            reward = float(move_resp.get("reward", 0.0))
            done = bool(move_resp.get("done", False))
            episode_score += reward

            # Get next state.
            if done:
                next_state = np.zeros(args.state_dim, dtype=np.float32)
                next_mask = np.zeros(4, dtype=np.float32)
            else:
                try:
                    enc2 = client.get_encoded(game_id)
                    next_state = flat_state_to_array(enc2["encodedFlat"], args.state_dim)
                    next_mask = action_mask_to_array(enc2["actionMask"])
                except Exception:
                    break

            buffer.push(state, action, reward, next_state, done, next_mask)

            # Track max tile from move response.
            curr_state = move_resp.get("current", {})
            for row in curr_state.get("grid", []):
                for cell in row:
                    if cell and cell.get("t") == "n":
                        episode_max_tile = max(episode_max_tile, cell.get("v", 0))

            state = next_state
            mask = next_mask
            step += 1

            if done or step >= 2000:
                break

        scores.append(episode_score)
        max_tiles.append(episode_max_tile)

        if game_num % 10 == 0 or game_num == args.collect_games:
            recent_scores = scores[-10:]
            recent_tiles = max_tiles[-10:]
            print(
                f"[collect] game {game_num}/{args.collect_games} | "
                f"buf={len(buffer)} | "
                f"score={episode_score:.0f} | "
                f"avg10={sum(recent_scores)/len(recent_scores):.0f} | "
                f"maxTile={episode_max_tile} | "
                f"avgTile10={sum(recent_tiles)//len(recent_tiles)}"
            )

    buffer.save(args.buffer_path)
    print(f"\n[collect] done. {len(buffer)} total transitions.")
    if scores:
        print(f"[collect] score stats: min={min(scores):.0f} mean={sum(scores)/len(scores):.0f} max={max(scores):.0f}")


# ---------------------------------------------------------------------------
# Phase 2: Train
# ---------------------------------------------------------------------------

def train_phase(args: argparse.Namespace, agent: Any, buffer: ReplayBuffer) -> None:
    """
    DQN training loop.

    TRAINING DYNAMICS:
        ε (epsilon): starts at 1.0 (100% random actions — pure exploration)
                     decays to ε_min over the first 80% of training steps
                     ("epsilon schedule")
        Target network: copied from the online network every `target_update`
                        steps to stabilise the Q-targets.

    You can monitor convergence by watching the loss:
        - Decreasing loss = the network is improving.
        - Oscillating/increasing loss = try lower learning rate or larger batch.
        - Loss stuck at high value = network may be underpowered (increase hidden_dim).
    """
    if len(buffer) < args.batch_size:
        print(f"[train] buffer has only {len(buffer)} samples, need {args.batch_size}. Run collect first.")
        return

    print(f"\n[train] starting {args.train_steps} steps, batch={args.batch_size}")

    epsilon_start = 1.0
    epsilon_end = 0.05
    epsilon_decay_steps = int(args.train_steps * 0.8)
    target_update = 500
    log_every = max(1, args.train_steps // 20)

    total_loss = 0.0
    for step in range(1, args.train_steps + 1):
        # Epsilon schedule: linear decay from epsilon_start to epsilon_end.
        epsilon = max(
            epsilon_end,
            epsilon_start - (epsilon_start - epsilon_end) * step / epsilon_decay_steps
        )

        batch = buffer.sample(min(args.batch_size, len(buffer)))
        loss = agent.train_step(batch)
        total_loss += loss

        if step % target_update == 0:
            agent.update_target()

        if step % log_every == 0:
            avg_loss = total_loss / log_every
            total_loss = 0.0
            print(f"[train] step {step}/{args.train_steps} | ε={epsilon:.3f} | avg_loss={avg_loss:.4f}")

    agent.save(args.model_path)
    print(f"\n[train] done. Model saved to {args.model_path}")


# ---------------------------------------------------------------------------
# Phase 3: Submit (evaluation)
# ---------------------------------------------------------------------------

def submit_phase(args: argparse.Namespace, agent: Any, client: GameClient) -> None:
    """
    Evaluate the trained agent by playing `submit_games` full games greedily
    (no random exploration — epsilon=0).

    Reports mean, max, and min score, plus average max tile reached.
    """
    print(f"\n[submit] evaluating {args.submit_games} games (greedy, ε=0)")

    scores: List[float] = []
    max_tiles: List[int] = []
    wins: int = 0

    for game_num in range(1, args.submit_games + 1):
        seed = random.randint(1, 2_147_483_647)

        try:
            game_resp = client.create_game(seed=seed)
        except Exception as e:
            print(f"[submit] game {game_num}: create_game failed: {e}")
            continue

        game_id = game_resp["id"]
        episode_score = 0.0
        episode_max_tile = 0

        try:
            enc = client.get_encoded(game_id)
        except Exception as e:
            print(f"[submit] game {game_num}: get_encoded failed: {e}")
            continue

        state = flat_state_to_array(enc["encodedFlat"], args.state_dim)
        mask = action_mask_to_array(enc["actionMask"])

        for _ in range(2000):
            action = agent.act(state, mask, epsilon=0.0)
            direction = ACTION_DIRS[action]

            try:
                move_resp = client.move(game_id, direction)
            except Exception as e:
                print(f"[submit] game {game_num}: move failed: {e}")
                break

            reward = float(move_resp.get("reward", 0.0))
            done = bool(move_resp.get("done", False))
            episode_score += reward

            curr_state = move_resp.get("current", {})
            if curr_state.get("won"):
                wins += 1

            for row in curr_state.get("grid", []):
                for cell in row:
                    if cell and cell.get("t") == "n":
                        episode_max_tile = max(episode_max_tile, cell.get("v", 0))

            if done:
                break

            try:
                enc = client.get_encoded(game_id)
                state = flat_state_to_array(enc["encodedFlat"], args.state_dim)
                mask = action_mask_to_array(enc["actionMask"])
            except Exception:
                break

        scores.append(episode_score)
        max_tiles.append(episode_max_tile)
        print(f"[submit] game {game_num}/{args.submit_games} | score={episode_score:.0f} | maxTile={episode_max_tile}")

    if scores:
        print(f"\n[submit] results over {len(scores)} games:")
        print(f"  mean score : {sum(scores)/len(scores):.1f}")
        print(f"  max score  : {max(scores):.1f}")
        print(f"  min score  : {min(scores):.1f}")
        print(f"  mean tile  : {sum(max_tiles)//len(max_tiles)}")
        print(f"  max tile   : {max(max_tiles)}")
        print(f"  win rate   : {wins}/{len(scores)} = {100*wins/len(scores):.1f}%")


# ---------------------------------------------------------------------------
# Phase 4: Export
# ---------------------------------------------------------------------------

def export_phase(args: argparse.Namespace, client: GameClient) -> None:
    """
    Pull training data from the server and write to disk.

    Formats:
        csv         — replays.csv + labels.csv (no extra dependencies)
        huggingface — replays.parquet + labels.parquet + dataset_card.md
                      (requires: pip install pandas pyarrow)

    Hugging Face is a platform that hosts open datasets. Once you create an
    account at huggingface.co you can push these files with:
        pip install huggingface_hub
        huggingface-cli upload your-username/binary2048 replays.parquet
    See dataset_card.md for the auto-generated README to include.
    """
    fmt = args.format
    print(f"\n[export] pulling training data, format={fmt}")

    # --- Replays ---
    replays: List[Dict] = []
    for page in range(1, args.export_pages + 1):
        try:
            resp = client.get_training_replays(page=page, limit=100, bot=args.export_bot)
            batch = resp.get("data", [])
            replays.extend(batch)
            print(f"[export] replays page {page}: got {len(batch)} records (total {len(replays)})")
            if len(batch) == 0:
                break
            time.sleep(0.1)
        except Exception as e:
            print(f"[export] replays page {page} error: {e}")
            break

    # --- Labels ---
    labels: List[Dict] = []
    for page in range(1, args.export_pages + 1):
        try:
            resp = client.get_training_labels(
                page=page,
                limit=100,
                strategy=args.label_strategy,
                min_tile=args.min_tile,
            )
            batch = resp.get("data", [])
            labels.extend(batch)
            print(f"[export] labels page {page}: got {len(batch)} records (total {len(labels)})")
            if len(batch) == 0:
                break
            time.sleep(0.1)
        except Exception as e:
            print(f"[export] labels page {page} error: {e}")
            break

    if not replays and not labels:
        print("[export] no data retrieved. Is the server running?")
        return

    if fmt == "csv" or not PYARROW_AVAILABLE or not PANDAS_AVAILABLE:
        if fmt == "huggingface" and (not PYARROW_AVAILABLE or not PANDAS_AVAILABLE):
            print("[export] pyarrow/pandas not installed — falling back to CSV")

        # Write CSV.
        if replays:
            _write_csv("replays.csv", replays)
        if labels:
            _write_labels_csv("labels.csv", labels)
    else:
        # Write Parquet (Hugging Face format).
        if replays:
            df = pd.DataFrame(replays)
            df.to_parquet("replays.parquet", index=False)
            print(f"[export] wrote replays.parquet ({len(df)} rows)")

        if labels:
            # Expand flat_state and action_mask lists into separate columns.
            rows = []
            for r in labels:
                row = {
                    "best_action": r["best_action"],
                    "confidence": r["confidence"],
                    "source": r["source"],
                }
                for i, v in enumerate(r.get("flat_state", [])):
                    row[f"s{i}"] = v
                for i, v in enumerate(r.get("action_mask", [])):
                    row[f"m{i}"] = v
                rows.append(row)
            df = pd.DataFrame(rows)
            df.to_parquet("labels.parquet", index=False)
            print(f"[export] wrote labels.parquet ({len(df)} rows)")

        _write_dataset_card(len(replays), len(labels))

    print("[export] done.")


def _write_csv(path: str, rows: List[Dict]) -> None:
    if not rows:
        return
    keys = list(rows[0].keys())
    with open(path, "w") as f:
        f.write(",".join(keys) + "\n")
        for row in rows:
            f.write(",".join(str(row.get(k, "")) for k in keys) + "\n")
    print(f"[export] wrote {path} ({len(rows)} rows)")


def _write_labels_csv(path: str, labels: List[Dict]) -> None:
    """Write labels CSV with flat_state and action_mask expanded into columns."""
    if not labels:
        return
    n_state = len(labels[0].get("flat_state", []))
    n_mask = len(labels[0].get("action_mask", []))
    header = (
        [f"s{i}" for i in range(n_state)]
        + [f"m{i}" for i in range(n_mask)]
        + ["best_action", "confidence", "source"]
    )
    with open(path, "w") as f:
        f.write(",".join(header) + "\n")
        for row in labels:
            vals = (
                [str(v) for v in row.get("flat_state", [])]
                + [str(v) for v in row.get("action_mask", [])]
                + [str(row.get("best_action", "")), str(row.get("confidence", "")), str(row.get("source", ""))]
            )
            f.write(",".join(vals) + "\n")
    print(f"[export] wrote {path} ({len(labels)} rows)")


def _write_dataset_card(n_replays: int, n_labels: int) -> None:
    """Write a Hugging Face dataset README template."""
    card = f"""\
---
license: apache-2.0
task_categories:
  - reinforcement-learning
tags:
  - game
  - 2048
  - binary-2048
  - rl
  - bot
pretty_name: Binary-2048 Training Dataset
size_categories:
  - 1K<n<10K
---

# Binary-2048 Training Dataset

Automatically generated training data from the
[Binary-2048](https://binary2048.com) game API.

## Dataset splits

| Split | Rows | Description |
|---|---|---|
| `replays` | {n_replays} | Seeded bot game summaries (seed, score, max_tile, turns) |
| `labels` | {n_labels} | Per-step (state, action_mask, best_action) tuples for supervised learning |

## State encoding

Each board position is encoded as a 32-float vector (`s0` ... `s31`).
Cells are listed row-major (top-left to bottom-right), each occupying 2 floats:
- `type`: 0=empty, 1=zero, 2=number, 3=wildcard, 4=lock
- `value`: log2(tile_value) for number tiles; log2(multiplier) for wildcards

## Action space

Actions are indexed as: 0=Left, 1=Right, 2=Up, 3=Down.
`m0`...`m3` are the action mask (1=legal, 0=illegal for that board position).

## Reproducibility

All replay records are generated deterministically from `(seed, bot)` pairs
using the Binary-2048 game engine. Any row can be reproduced by calling:

```bash
curl -X POST https://binary2048.com/api/simulate \\
  -H 'Content-Type: application/json' \\
  -d '{{"seed": SEED, "moves": [...]}}'
```

## Citation

If you use this dataset in research, please cite the Binary-2048 project:

```
@misc{{binary2048,
  title  = {{Binary-2048: A Deterministic Benchmark Environment for Discrete Action RL}},
  year   = {{2026}},
  url    = {{https://binary2048.com}}
}}
```
"""
    with open("dataset_card.md", "w") as f:
        f.write(card)
    print("[export] wrote dataset_card.md")


# ---------------------------------------------------------------------------
# Agent factory — picks torch or numpy based on availability and args
# ---------------------------------------------------------------------------

def make_agent(args: argparse.Namespace) -> Any:
    if TORCH_AVAILABLE and not getattr(args, "force_numpy", False):
        print("[agent] using PyTorch DQN")
        return DQNAgent(state_dim=args.state_dim)
    else:
        print("[agent] PyTorch unavailable — using numpy DQN (slower)")
        return DQNAgentNumpy(state_dim=args.state_dim)


def load_agent(args: argparse.Namespace) -> Any:
    agent = make_agent(args)
    model_path = args.model_path
    numpy_path = model_path.replace(".pt", "_numpy.pkl")

    if TORCH_AVAILABLE and os.path.exists(model_path):
        agent.load(model_path)
    elif os.path.exists(numpy_path):
        agent.load(numpy_path)
    elif os.path.exists(model_path):
        agent.load(model_path)
    else:
        print(f"[agent] no saved model found at {model_path} — using random weights")
    return agent


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Binary-2048 ML training pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--phase", choices=["all", "collect", "train", "submit", "export"],
                   default="all", help="Pipeline phase to run (default: all)")
    p.add_argument("--base-url", default="http://localhost:3000",
                   help="Game server base URL (default: http://localhost:3000)")

    # Collect
    p.add_argument("--collect-games", type=int, default=200,
                   help="Number of self-play games to collect (default: 200)")
    p.add_argument("--collect-mode", choices=["mcts", "priority", "random"],
                   default="mcts", help="Collection policy (default: mcts)")
    p.add_argument("--mcts-sims", type=int, default=20,
                   help="MCTS rollouts per candidate action (default: 20)")

    # Train
    p.add_argument("--train-steps", type=int, default=10_000,
                   help="Gradient update steps (default: 10000)")
    p.add_argument("--batch-size", type=int, default=32,
                   help="Mini-batch size (default: 32)")

    # Submit
    p.add_argument("--submit-games", type=int, default=20,
                   help="Evaluation games in submit phase (default: 20)")

    # Export
    p.add_argument("--format", choices=["csv", "huggingface"], default="csv",
                   help="Export format (default: csv)")
    p.add_argument("--export-pages", type=int, default=5,
                   help="Pages to pull from training API per split (default: 5)")
    p.add_argument("--export-bot", default="rollout",
                   help="Bot to use for replay export (default: rollout)")
    p.add_argument("--label-strategy", choices=["score_delta", "rollout"],
                   default="score_delta", help="Labeling strategy for export (default: score_delta)")
    p.add_argument("--min-tile", type=int, default=0,
                   help="Minimum tile reached to include labels (default: 0)")

    # Model / buffer paths
    p.add_argument("--model-path", default="dqn_model.pt",
                   help="Path to save/load model (default: dqn_model.pt)")
    p.add_argument("--buffer-path", default="replay_buffer.pkl",
                   help="Replay buffer file (default: replay_buffer.pkl)")
    p.add_argument("--state-dim", type=int, choices=[32, 256], default=32,
                   help="State vector dimension: 32=raw, 256=one-hot (default: 32)")
    p.add_argument("--buffer-capacity", type=int, default=50_000,
                   help="Replay buffer capacity (default: 50000)")
    p.add_argument("--force-numpy", action="store_true",
                   help="Force numpy DQN even when PyTorch is available")

    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    # Normalise model path for numpy agent.
    if not TORCH_AVAILABLE or args.force_numpy:
        if args.model_path == "dqn_model.pt":
            args.model_path = "dqn_model_numpy.pkl"

    client = GameClient(base_url=args.base_url)

    # Health check before starting.
    if args.phase != "export":
        print(f"[init] connecting to {args.base_url} ...")
        if not client.health():
            print(
                f"[init] ERROR: cannot reach {args.base_url}\n"
                "       Make sure the dev server is running: npm run dev"
            )
            sys.exit(1)
        print("[init] server OK")

    # Run requested phase(s).
    if args.phase == "export":
        export_phase(args, client)
        return

    if args.phase in ("collect", "all"):
        buffer = ReplayBuffer(capacity=args.buffer_capacity)
        if os.path.exists(args.buffer_path):
            buffer.load(args.buffer_path)
        collect_phase(args, client, buffer)
    else:
        buffer = ReplayBuffer(capacity=args.buffer_capacity)
        if os.path.exists(args.buffer_path):
            buffer.load(args.buffer_path)

    if args.phase in ("train", "all"):
        agent = make_agent(args)
        train_phase(args, agent, buffer)
    else:
        agent = None

    if args.phase in ("submit", "all"):
        if agent is None:
            agent = load_agent(args)
        submit_phase(args, agent, client)


if __name__ == "__main__":
    main()
