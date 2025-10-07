from app.services.state import ConversationState


def test_apply_output_contexts_tracks_lifespan():
    state = ConversationState()
    session_id = "test-session"

    assert state.get_active_contexts(session_id) == {}

    state.apply_output_contexts(session_id, [("OrderFlow", 2)])
    assert state.get_active_contexts(session_id) == {"orderflow": 2}

    state.apply_output_contexts(session_id, [])
    assert state.get_active_contexts(session_id) == {"orderflow": 1}

    state.apply_output_contexts(session_id, [])
    assert state.get_active_contexts(session_id) == {}


def test_apply_output_contexts_zero_lifespan_removes():
    state = ConversationState()
    session_id = "test-session"

    state.apply_output_contexts(session_id, [("status_flow", 3)])
    assert state.get_active_contexts(session_id) == {"status_flow": 3}

    state.apply_output_contexts(session_id, [("status_flow", 0)])
    assert state.get_active_contexts(session_id) == {}
