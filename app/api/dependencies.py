from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.database import session_dependency

DatabaseSession = Annotated[Session, Depends(session_dependency)]
