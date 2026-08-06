from collections.abc import Generator
from threading import Lock

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


class Database:
    """Thread-safe singleton around the SQLAlchemy engine."""

    _instance: "Database | None" = None
    _lock = Lock()

    def __init__(self) -> None:
        settings = get_settings()
        connect_args = (
            {"check_same_thread": False}
            if settings.database_url.startswith("sqlite")
            else {}
        )
        self.engine = create_engine(
            settings.database_url,
            connect_args=connect_args,
        )
        self.session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )

    @classmethod
    def instance(cls) -> "Database":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def create_schema(self) -> None:
        from app.db import models  # noqa: F401

        Base.metadata.create_all(bind=self.engine)

    def session(self) -> Session:
        return self.session_factory()


def session_dependency() -> Generator[Session, None, None]:
    session = Database.instance().session()
    try:
        yield session
    finally:
        session.close()
