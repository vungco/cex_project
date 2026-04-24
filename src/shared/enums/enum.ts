export enum SpotEvent {
  JoinRoom = 'spot:join_room',
  LeaveRoom = 'spot:leave_room',
  OrderbookUpdate = 'spot:orderbook_update',
  TradeMatch = 'spot:trade_match',

  JoinTimeframe = 'spot:join_timeframe',
  LeaveTimeframe = 'spot:leave_timeframe',
  Timeframe = 'spot:timeframe_change',
  InitCandle = 'spot:init_candle',
  Ticker = 'spot:ticker',
  TickerSnapshot = 'spot:tickerSnapshot',
  OrderCancelled = 'spot:orderCancelled',
  TickerBatch = 'spot:ticker:batch',
  INITTICKER = 'spot:ticker:init',
}

// enums.ts
export enum OrderEventTypeChange {
  ORDERCHANGE = 'ORDERCHANGE',
}

export enum DepositEvent {
  CREATE = 'CREATEDEPOSIT',
}

/** Cùng cơ chế thanh toán với nạp: `SpotPublicGateway` emit tới `socket` user */
export enum WithdrawEvent {
  /** Payload gồm `type: 'WITHDRAWAL_UPDATED'` (xem `WithdrawalUpdatedEmitDto`) */
  UPDATED = 'WITHDRAWAL_UPDATED',
}

export enum MarketEvent {
  CREATE = 'market_token:create',
  UPDATE = 'market_token:update',
  DELETE = 'market_token:delete',
  ACTIVE = 'market_token:active',
  INACTIVE = 'market_token:inactive',
}
