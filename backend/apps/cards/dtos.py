import datetime
from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class CardWriteDTO:
    name: str
    color: str
    closing_day: int
    due_day: int
    limit: Decimal | None = None
    functions: list[str] = field(default_factory=list)
    bank: str = "other"
    is_active: bool = True


@dataclass
class InvoiceDTO:
    amount: Decimal
    snapshot_amount: Decimal | None
    is_paid: bool
    divergent: bool
    cycle_start: datetime.date
    cycle_end: datetime.date
    due_date: datetime.date


@dataclass
class CardSummaryDTO:
    card_id: int
    name: str
    color: str
    closing_day: int
    due_day: int
    functions: list[str]
    limit: Decimal | None
    committed: Decimal
    committed_pct: Decimal | None
    open_cycle_spend: Decimal
    invoice: InvoiceDTO
    bank: str = "other"
    is_active: bool = True
