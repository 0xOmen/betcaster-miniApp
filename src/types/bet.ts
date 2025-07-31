export interface Bet {
  bet_number: number;
  maker_address: string;
  taker_address: string[];
  arbiter_address: string[] | null;
  bet_token_address: string;
  bet_amount: number;
  taker_bet_token_address: string;
  taker_bet_amount: number;
  can_settle_early: boolean;
  taker_deadline: number;
  timestamp: number;
  end_time: number;
  status: number;
  protocol_fee: number;
  arbiter_fee: number;
  bet_agreement: string;
  transaction_hash: string | null;
  maker_fid?: number | null;
  taker_fid?: number | null;
  arbiter_fid?: number | null;
  makerProfile?: UserProfile | null;
  takerProfile?: UserProfile | null;
  arbiterProfile?: UserProfile | null;
}

export interface UserProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
}

export interface NeynarUser {
  fid: number;
  score: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
}
