export { BaseRepository } from "./base.repository.js";
export { StockRepository, stockRepository } from "./stock.repository.js";
export { OrderRepository, orderRepository } from "./order.repository.js";

export type {
  StockMovementInput,
  StockUpdateResult,
} from "./stock.repository.js";

export type {
  CreateOrderInput,
  UpdateDraftInput,
} from "./order.repository.js";
