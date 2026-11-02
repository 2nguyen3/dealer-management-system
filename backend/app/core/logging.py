"""Application loggers; Uvicorn owns handler/level configuration at deployment.

Call sites emit fixed event labels, without credential values or exception text.
"""

import logging

auth_logger = logging.getLogger("app.modules.auth.service")
health_logger = logging.getLogger("app.modules.health.router")
