try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from tokenizers import Tokenizer
except ImportError:
    torch = None
    nn = None
    F = None
    Tokenizer = None

if nn is None:
    class _UnavailableTorch:
        class Module:
            def __init__(self, *args, **kwargs):
                pass

    nn = _UnavailableTorch

if torch is None:
    def _inference_mode(func):
        return func
else:
    _inference_mode = torch.inference_mode


class Head(nn.Module):
    def __init__(self, n_embd, head_size, block_size, dropout):
        super().__init__()
        self.key = nn.Linear(n_embd, head_size, bias=False)
        self.query = nn.Linear(n_embd, head_size, bias=False)
        self.value = nn.Linear(n_embd, head_size, bias=False)
        self.register_buffer("tril", torch.tril(torch.ones(block_size, block_size)))
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        B, T, C = x.shape
        k = self.key(x)
        q = self.query(x)
        wei = q @ k.transpose(-2, -1) * k.size(-1)**-0.5
        wei = wei.masked_fill(self.tril[:T, :T] == 0, float("-inf"))
        wei = self.dropout(F.softmax(wei, dim=-1))
        return wei @ self.value(x)


class MultiHeadAttention(nn.Module):
    def __init__(self, n_embd, n_head, block_size, dropout):
        super().__init__()
        head_size = n_embd // n_head
        self.heads = nn.ModuleList([
            Head(n_embd, head_size, block_size, dropout)
            for _ in range(n_head)
        ])
        self.proj = nn.Linear(n_embd, n_embd)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        out = torch.cat([h(x) for h in self.heads], dim=-1)
        return self.dropout(self.proj(out))


class FeedForward(nn.Module):
    def __init__(self, n_embd, dropout):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_embd, 4 * n_embd),
            nn.ReLU(),
            nn.Linear(4 * n_embd, n_embd),
            nn.Dropout(dropout)
        )

    def forward(self, x):
        return self.net(x)


class Block(nn.Module):
    def __init__(self, n_embd, n_head, block_size, dropout):
        super().__init__()
        self.sa = MultiHeadAttention(n_embd, n_head, block_size, dropout)
        self.ffwd = FeedForward(n_embd, dropout)
        self.ln1 = nn.LayerNorm(n_embd)
        self.ln2 = nn.LayerNorm(n_embd)

    def forward(self, x):
        x = x + self.sa(self.ln1(x))
        x = x + self.ffwd(self.ln2(x))
        return x


class GPTLanguageModel(nn.Module):
    def __init__(self, vocab_size, config):
        super().__init__()
        n_embd = config["n_embd"]
        n_head = config["n_head"]
        n_layer = config["n_layer"]
        block_size = config["block_size"]
        dropout = config["dropout"]

        self.token_embedding_table = nn.Embedding(vocab_size, n_embd)
        self.position_embedding_table = nn.Embedding(block_size, n_embd)

        self.blocks = nn.Sequential(*[
            Block(n_embd, n_head, block_size, dropout)
            for _ in range(n_layer)
        ])

        self.ln_f = nn.LayerNorm(n_embd)
        self.lm_head = nn.Linear(n_embd, vocab_size)

    def forward(self, idx):
        B, T = idx.shape
        tok_emb = self.token_embedding_table(idx)
        pos_emb = self.position_embedding_table(
            torch.arange(T, device=idx.device)
        )
        x = tok_emb + pos_emb
        x = self.ln_f(self.blocks(x))
        return self.lm_head(x)


class MiniGPTEngine:
    def __init__(self, model_path):
        if torch is None:
            self.device = "unavailable"
            self.model = None
            print("Neural engine unavailable in lightweight deployment.")
            return

        self.device = "cpu"

        checkpoint = torch.load(
            model_path,
            map_location=self.device,
            weights_only=True
        )

        self.config = checkpoint["config"]
        self.block_size = self.config["block_size"]

        self.tokenizer = Tokenizer.from_str(
            checkpoint["tokenizer_json"]
        )

        self.model = GPTLanguageModel(
            checkpoint["vocab_size"],
            self.config
        ).to(self.device)

        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()

        print("MiniGPT trained model loaded successfully!")

    @_inference_mode()
    def reply(self, question, max_new_tokens=40):
        if torch is None:
            raise ValueError("Neural mode is unavailable in this lightweight deployment.")
        bos = self.tokenizer.token_to_id("[BOS]")
        user = self.tokenizer.token_to_id("[USER]")
        assistant = self.tokenizer.token_to_id("[ASSISTANT]")
        eos = self.tokenizer.token_to_id("[EOS]")
        pad = self.tokenizer.token_to_id("[PAD]")

        tokens = [bos, user] + self.tokenizer.encode(question).ids + [assistant]

        if len(tokens) > self.block_size:
            raise ValueError("Question is too long. Please shorten it.")

        idx = torch.tensor([tokens], dtype=torch.long)
        reply = []

        limit = min(max_new_tokens, self.block_size - len(tokens) + 1)

        for _ in range(limit):
            logits = self.model(idx)
            next_id = logits[0, -1].argmax().item()

            if next_id in [bos, user, assistant, eos, pad]:
                break

            reply.append(next_id)
            idx = torch.cat((idx, torch.tensor([[next_id]])), dim=1)

        return self.tokenizer.decode(reply).strip()