import { useCountUp } from '../lib/useCountUp';
import { formatMoney, formatMoneySigned } from '../lib/metrics';

interface Props {
  value: number;
  signed?: boolean;
  duration?: number;
}

/** Renders an animated, count-up money figure. */
export default function MoneyCountUp({ value, signed = true, duration }: Props) {
  const v = useCountUp(value, duration);
  return <>{signed ? formatMoneySigned(v) : formatMoney(v)}</>;
}
