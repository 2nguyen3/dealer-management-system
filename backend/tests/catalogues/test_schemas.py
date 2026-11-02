import pytest
from pydantic import ValidationError

from app.common.catalogue import MasterCreate, MasterUpdate, PatchModel
from app.modules.agency_types.schemas import AgencyTypeCreate, AgencyTypeUpdate
from app.modules.units.schemas import UnitCreate, UnitUpdate
from app.modules.users.schemas import AdminPasswordReset, UserCreate, UserUpdate


@pytest.mark.parametrize("model", [MasterUpdate, AgencyTypeUpdate, UnitUpdate, UserUpdate])
@pytest.mark.parametrize(
    "body",
    [{}, None, [], {"unexpected": "credential-sentinel"}, {"status": None}, {"status": "bad"}],
)
def test_patch_rejects_empty_null_extra_and_bad_status(model, body):
    with pytest.raises(ValidationError) as error:
        model.model_validate(body)
    assert "credential-sentinel" not in str(error.value)


@pytest.mark.parametrize("field", ["code", "name", "status"])
def test_master_update_nonnullable_fields(field):
    with pytest.raises(ValidationError):
        MasterUpdate.model_validate({field: None})
    assert MasterUpdate(status="INACTIVE").model_dump(exclude_unset=True) == {"status": "INACTIVE"}


def test_master_unit_defaults_exact_money_and_password_boundaries():
    assert MasterCreate(code="Q", name="Quận").status == "ACTIVE"
    assert not UnitCreate(code="PIECE", name="Cái").allowsFraction
    assert UnitUpdate(allowsFraction=False).model_dump(exclude_unset=True) == {
        "allowsFraction": False
    }
    assert (
        AgencyTypeCreate(code="T", name="T", maxDebt="0").model_dump(mode="json")["maxDebt"] == "0"
    )
    assert (
        AgencyTypeUpdate(maxDebt="999999999999999999").model_dump(mode="json")["maxDebt"]
        == "999999999999999999"
    )
    for password in ("x", " "):
        user = UserCreate(fullName="Name", email="Mixed@Example.com", password=password, groupId=1)
        assert user.password == password and "password=" not in repr(user)
        reset = AdminPasswordReset(newPassword=password)
        assert reset.newPassword == password and "newPassword=" not in repr(reset)
    assert UserUpdate(email="Mixed@Example.com").email == "Mixed@Example.com"
    assert PatchModel.nonempty_patch({"name": "valid"}) == {"name": "valid"}


@pytest.mark.parametrize("value", [None, "", "1.1", "01", "1000000000000000000", 0, True, 1.5])
def test_money_input_is_exact(value):
    with pytest.raises(ValidationError):
        AgencyTypeCreate(code="T", name="T", maxDebt=value)


@pytest.mark.parametrize("value", [None, "false", 0, 1])
def test_fraction_is_strict_boolean(value):
    with pytest.raises(ValidationError):
        UnitUpdate(allowsFraction=value)


@pytest.mark.parametrize(
    "body",
    [
        {"email": "bad"},
        {"email": "a@-invalid.com"},
        {"email": None},
        {"groupId": "1"},
        {"groupId": 0},
        {"groupId": 2147483648},
        {"fullName": " "},
        {"password": "credential-sentinel"},
    ],
)
def test_user_patch_safe_invalid_inputs(body):
    with pytest.raises(ValidationError) as error:
        UserUpdate.model_validate(body)
    assert "credential-sentinel" not in str(error.value)
