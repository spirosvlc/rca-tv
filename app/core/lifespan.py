import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db.database import Database
from app.integrations.telegram_bot import TelegramBotWorker

logger = logging.getLogger(__name__)


@asynccontextmanager
async def application_lifespan(app: FastAPI):
    database = Database.instance()
    database.create_schema()

    telegram_worker = TelegramBotWorker()
    telegram_task = asyncio.create_task(telegram_worker.run())

    app.state.database = database
    app.state.telegram_worker = telegram_worker

    try:
        yield
    finally:
        telegram_task.cancel()
        try:
            await telegram_task
        except asyncio.CancelledError:
            logger.info("Telegram worker stopped.")
