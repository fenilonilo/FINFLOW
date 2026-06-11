from dataclasses import dataclass
from typing import Protocol


@dataclass
class AdviceDTO:
    message: str = ""


@dataclass
class BudgetGoalDTO:
    pass


@dataclass
class BudgetPlanDTO:
    pass


class AIAdvisorPort(Protocol):
    def analyze_spending(self, summary: object) -> AdviceDTO:
        ...

    def plan_budget(self, goal: BudgetGoalDTO) -> BudgetPlanDTO:
        ...


class NotificationPort(Protocol):
    def notify(self, user_id: int, title: str, body: str) -> None:
        ...
