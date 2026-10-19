// User's planning assumption for factor farming, not an acquisition guarantee.
export const FARMING_POLICY='inherited-body-v1';
export const INHERITED_FARMING_SKILLS=['レースの真髄・体'];
export const usesInheritedFactor=row=>INHERITED_FARMING_SKILLS.includes(row?.name);
export const INHERITED_FACTOR_NOTE='レースの真髄・体は既存因子から継承する前提です。本育成の優先度は高のまま、周回サポカの採用点には含めません。';
