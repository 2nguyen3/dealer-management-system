import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.users.models import AppUser
from tests.support.database import selected_database_factory


@pytest.fixture(scope="session")
def database_factory():
    with selected_database_factory(suite="business") as create:
        yield create


@pytest.fixture(scope="session")
def shared_engine(database_factory):
    with database_factory() as engine:
        with engine.begin() as connection:
            connection.exec_driver_sql("""
                CREATE TABLE dms.probe (
                  id bigint PRIMARY KEY, value integer NOT NULL, name text NOT NULL,
                  CONSTRAINT positive_probe CHECK (value>=0)
                );
                INSERT INTO dms.probe VALUES (1,0,'same'), (2,0,'same'), (3,0,'z');
                CREATE TABLE dms.probe_child (
                  id bigint PRIMARY KEY, parent bigint NOT NULL,
                  CONSTRAINT probe_parent FOREIGN KEY (parent) REFERENCES dms.probe(id)
                    DEFERRABLE INITIALLY DEFERRED
                );
                CREATE TABLE dms.probe_keys (id uuid PRIMARY KEY);
                CREATE FUNCTION dms.probe_refresh() RETURNS trigger LANGUAGE plpgsql AS $$
                  BEGIN
                    UPDATE dms.probe SET value=value+1 WHERE id=NEW.parent;
                    RETURN NULL;
                  END $$;
                CREATE CONSTRAINT TRIGGER refresh_probe AFTER INSERT ON dms.probe_child
                  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dms.probe_refresh();
            """)
        yield engine


@pytest.fixture
def engine(shared_engine):
    with shared_engine.begin() as connection:
        connection.exec_driver_sql("TRUNCATE dms.app_user RESTART IDENTITY CASCADE")
        connection.exec_driver_sql("TRUNCATE dms.district RESTART IDENTITY CASCADE")
        connection.exec_driver_sql("TRUNCATE dms.probe_child")
        connection.exec_driver_sql("TRUNCATE dms.probe_keys")
        connection.exec_driver_sql("UPDATE dms.probe SET value=0")
    yield shared_engine


@pytest.fixture
def actor(engine):
    with Session(engine) as session:
        identifier = session.scalar(text("SELECT id FROM dms.user_group WHERE code='MANAGEMENT'"))
        user = AppUser(
            full_name="Test",
            email="test@example.com",
            password_hash="test hash",
            group_id=identifier,
        )
        session.add(user)
        session.commit()
        return user.id
