"""引擎回合收口。CTF / SRC / 红队同一套，不按赛道分叉。

从者结束或写出收尾 → 本轮必须把控制权交回御主。
工人不得把 gather 拖死。单轮墙钟到点也强制收口。
"""
from __future__ import annotations

# 从者/工人写出这些即视为本轮会话该停。中英都收，避免模型换语言后继续打。
TURN_DONE_MARKS: tuple[str, ...] = (
    "本轮完成",
    "已完成本轮",
    "本轮小结",
    "本轮从者已完成",
    "收尾如下",
    "收尾结论",
    "本轮结束",
    "结束本轮",
    "round complete",
    "finished this turn",
    "wrapping up this turn",
)

# 从者已返回后，给工人 abort 落地的宽限；超时取消任务，避免 abort 无效时再卡死。
WORKER_ABORT_GRACE_SEC = 15.0


def role_wrote_turn_done(text: str, *, role: str = "") -> bool:
    """该角色正文是否在收工。二次验证会话不收口。"""
    r = str(role or "").strip().lower()
    if r == "finding-review" or r.startswith("finding-review:"):
        return False
    blob = str(text or "")
    if not blob.strip():
        return False
    low = blob.lower()
    for mark in TURN_DONE_MARKS:
        if not mark:
            continue
        if mark.isascii():
            if mark.lower() in low:
                return True
        elif mark in blob:
            return True
    return False


def turn_must_close(elapsed_sec: float, cap_sec: float) -> bool:
    """单轮墙钟是否已到。cap<=0 表示不启用。"""
    try:
        cap = float(cap_sec or 0)
        got = float(elapsed_sec or 0)
    except (TypeError, ValueError):
        return False
    return cap > 0 and got >= cap


def _assert_track_agnostic() -> None:
    """结构守卫：收口函数不得出现 objective/src/flag 参数。"""
    import inspect
    for fn in (role_wrote_turn_done, turn_must_close):
        names = set(inspect.signature(fn).parameters)
        assert not names & {"objective", "src", "flag", "redteam", "is_benchmark"}


_assert_track_agnostic()
