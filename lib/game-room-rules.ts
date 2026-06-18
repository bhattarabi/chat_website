import type { GameRoomRule, GameRoomRuleCategory } from "@/lib/types";

export const gameRoomRuleCategories: {
  key: GameRoomRuleCategory;
  title: string;
}[] = [
  { key: "redemption", title: "Redemption Policy" },
  { key: "payment", title: "Payment Methods" }
];

const defaultRuleBodies: Record<GameRoomRuleCategory, string[]> = {
  redemption: [
    "Live Agent 24/7",
    "Redeem Hours 12pm- 11pm Eastern Time Zone",
    "$500 max per day / until your balance is fully redeemed, (personal or business)",
    "2 Redeems allowed per day",
    "$Minimum redeem is $50"
  ],
  payment: [
    "Cashapp,",
    "Venmo,",
    "Paypal,",
    "Chime",
    "Apple Pay",
    "BinPay (Accept major, Debit & Credit Cards)",
    "Pandora (Accept Gpay, Min $20)"
  ]
};

export function defaultGameRoomRules(): GameRoomRule[] {
  return gameRoomRuleCategories.flatMap(({ key }) =>
    defaultRuleBodies[key].map((body, index) => ({
      id: `default-${key}-${index}`,
      category: key,
      body,
      sort_order: index,
      created_at: ""
    }))
  );
}

export function rulesByCategory(rules: GameRoomRule[] | null | undefined) {
  const source = rules?.length ? rules : defaultGameRoomRules();
  return gameRoomRuleCategories.map((category) => ({
    ...category,
    rules: source.filter((rule) => rule.category === category.key)
  }));
}
