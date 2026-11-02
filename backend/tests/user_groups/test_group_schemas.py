import pytest
from pydantic import ValidationError

from app.modules.user_groups.schemas import GroupCreate, GroupUpdate


def test_group_requests_strict_and_patch_omission():
    created = GroupCreate(code=" TEAM ", name="Team")
    assert created.code == " TEAM "
    assert GroupUpdate(name="Next").model_dump(exclude_unset=True) == {"name": "Next"}
    for model, values in (
        (GroupCreate, {"code": "", "name": "x"}),
        (GroupCreate, {"code": " \t", "name": "x"}),
        (GroupCreate, {"code": 1, "name": "x"}),
        (GroupCreate, {"code": "x", "name": "x", "extra": True}),
        (GroupUpdate, {}),
        (GroupUpdate, {"code": None}),
        (GroupUpdate, {"name": " "}),
        (GroupUpdate, {"extra": "x"}),
    ):
        with pytest.raises(ValidationError):
            model.model_validate(values)
    with pytest.raises(ValidationError):
        GroupUpdate.model_validate([])
