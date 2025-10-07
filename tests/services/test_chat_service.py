from types import SimpleNamespace

from app.services.chat_service import _select_fallback_intent, _should_reset_to_root_after_fallback


def make_intent(intent_id, parent_id=None, contexts=None):
    return SimpleNamespace(
        id=intent_id,
        parent_intent_id=parent_id,
        input_contexts=[SimpleNamespace(name=name) for name in (contexts or [])],
        children=[],
        is_fallback=True,
    )


def test_select_fallback_intent_prefers_matching_context():
    fallback_a = make_intent(3, parent_id=2, contexts=['support_flow'])
    fallback_b = make_intent(4, parent_id=1, contexts=['billing_flow'])
    intents_by_id = {
        1: SimpleNamespace(id=1, parent_intent_id=None),
        2: SimpleNamespace(id=2, parent_intent_id=1),
        3: fallback_a,
        4: fallback_b,
    }

    selected = _select_fallback_intent(
        fallback_intents=[fallback_a, fallback_b],
        active_contexts={'support_flow'},
        last_success_intent_id=2,
        intents_by_id=intents_by_id,
    )

    assert selected is fallback_a


def test_select_fallback_intent_uses_ancestor_when_no_context():
    fallback_parent = make_intent(5, parent_id=1, contexts=[])
    fallback_root = make_intent(6, parent_id=None, contexts=[])
    intents_by_id = {
        1: SimpleNamespace(id=1, parent_intent_id=None),
        2: SimpleNamespace(id=2, parent_intent_id=1),
        5: fallback_parent,
        6: fallback_root,
    }

    selected = _select_fallback_intent(
        fallback_intents=[fallback_parent, fallback_root],
        active_contexts=set(),
        last_success_intent_id=2,
        intents_by_id=intents_by_id,
    )

    assert selected is fallback_parent


def test_select_fallback_intent_returns_none_when_unavailable():
    selected = _select_fallback_intent(
        fallback_intents=[],
        active_contexts={'foo'},
        last_success_intent_id=None,
        intents_by_id={},
    )

    assert selected is None


def test_should_reset_to_root_after_global_fallback():
    assert _should_reset_to_root_after_fallback(None, 1) is True


def test_should_not_reset_when_fallback_child_of_last_intent():
    fallback_intent = make_intent(10, parent_id=7)
    assert _should_reset_to_root_after_fallback(fallback_intent, 7) is False


def test_should_not_reset_when_fallback_has_contexts():
    fallback_intent = make_intent(11, parent_id=None, contexts=['flow'])
    assert _should_reset_to_root_after_fallback(fallback_intent, None) is False


def test_should_reset_when_unrelated_layer():
    fallback_intent = make_intent(12, parent_id=None)
    assert _should_reset_to_root_after_fallback(fallback_intent, 3) is True
