from apps.common.ports import AdviceDTO, BudgetGoalDTO, BudgetPlanDTO


class NullAIAdvisor:
    """No-op AIAdvisorPort adapter (default in production wiring)."""

    def analyze_spending(self, summary: object) -> AdviceDTO:
        return AdviceDTO()

    def plan_budget(self, goal: BudgetGoalDTO) -> BudgetPlanDTO:
        return BudgetPlanDTO()


class ConsoleNotifier:
    """NotificationPort adapter that prints to stdout."""

    def notify(self, user_id: int, title: str, body: str) -> None:
        print(f"[NOTIFY] user={user_id} title={title} body={body}")
