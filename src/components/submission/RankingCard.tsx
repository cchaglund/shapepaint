import { PlacementSwatch } from '../shared/PlacementBanner';
import { Card } from '../shared/Card';
import { RankingBadge } from './RankingBadge';

interface RankingCardProps {
  rankInfo: { rank: number; total: number };
}

export function RankingCard({ rankInfo }: RankingCardProps) {
  return (
    <Card>
      <h2 className="text-basefont-semibold mb-3 text-(--color-text-primary)">
        Ranking
      </h2>
      <div className="flex items-center gap-3">
        {rankInfo.rank <= 3 && (
          <PlacementSwatch rank={rankInfo.rank as 1 | 2 | 3} />
        )}
        <RankingBadge rank={rankInfo.rank} total={rankInfo.total} />
      </div>
      {rankInfo.rank === 1 && (
        <p className="mt-2 text-basetext-(--color-text-secondary)">
          Winner of the day!
        </p>
      )}
    </Card>
  );
}
