import { useRef, useState } from 'react';
import { navigate } from '../lib/router';
import { Link } from '../components/shared/Link';
import { CardLikeButton } from '../components/shared/CardLikeButton';
import { useAuth } from '../hooks/auth/useAuth';
import { useSubmissions } from '../hooks/submission/useSubmissions';
import { useRanking } from '../hooks/challenge/useRanking';
import { useDailyChallenge } from '../hooks/challenge/useDailyChallenge';
import { useSubmissionDetail } from '../hooks/submission/useSubmissionDetail';
import { useExportActions } from '../hooks/submission/useExportActions';
import { useLikes } from '../hooks/social/useLikes';
import { useLikers } from '../hooks/social/useLikers';
import { FollowButton } from '../components/social/FollowButton';
import { AvatarImage } from '../components/shared/AvatarImage';
import { LikersTooltip } from '../components/social/LikersTooltip';
import { LikersModal } from '../components/social/LikersModal';
import { LoginPromptModal } from '../components/social/LoginPromptModal';
import { useSubmissionStatus } from '../contexts/SubmissionStatusContext';
import { getTodayDateUTC } from '../utils/dailyChallenge';
import {
  SubmissionCanvas,
  SubmissionNavigation,
  ChallengeDetailsCard,
  RankingCard,
  SubmissionStatsCard,
  ExportActionsCard,
} from '../components/submission';
import { useSetHeader } from '../contexts/HeaderContext';
import { BackButton } from '../components/shared/BackButton';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

interface SubmissionDetailPageProps {
  date?: string;
  submissionId?: string;
}

export function SubmissionDetailPage({ date, submissionId }: SubmissionDetailPageProps) {
  const { user } = useAuth();
  const { hasSubmittedToday, hasCheckedSubmission } = useSubmissionStatus();
  const todayStr = getTodayDateUTC();
  const { loadSubmission, getAdjacentSubmissionDates } = useSubmissions(user?.id);
  const { fetchSubmissionRank } = useRanking();
  const svgRef = useRef<SVGSVGElement>(null);

  // Load submission data
  const { submission, loading, rankInfo, error, adjacentDates, nickname, avatarUrl } = useSubmissionDetail({
    date,
    submissionId,
    user,
    loadSubmission,
    fetchSubmissionRank,
    getAdjacentSubmissionDates,
  });

  // Determine the challenge date from either prop or loaded submission
  const challengeDate = date || submission?.challenge_date || '';
  const { challenge } = useDailyChallenge(challengeDate);

  // Export actions
  const { downloadSVG, downloadPNG, copyShareLink } = useExportActions(svgRef, challengeDate);

  // Like state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const { isLiked, likeCount, toggleLike } = useLikes({
    userId: user?.id,
    submissionId: submission?.id,
    initialLikeCount: submission?.like_count ?? 0,
  });
  const isOwnSubmission = user?.id === submission?.user_id;

  // Likers data (fetched on page load)
  const { likers } = useLikers(submission?.id);

  const handleLikeToggle = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    toggleLike();
  };

  const formattedDate = challengeDate
    ? new Date(challengeDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Loading...';

  useSetHeader({
    centerContent: <span className="text-lg font-semibold text-(--color-text-primary) font-display">Submission</span>,
    rightContent: (
      <div className="flex items-center gap-2">
        {date && <SubmissionNavigation adjacentDates={adjacentDates} onNavigate={(d) => {
          const url = new URL(window.location.href);
          url.searchParams.set('date', d);
          navigate(url.toString());
        }} />}
        <BackButton href="/?view=gallery" label="Gallery" />
      </div>
    ),
  });

  // Only require auth when loading by date (own submission)
  if (!submissionId && !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-(--color-bg-primary)">
        <p className="text-sm text-(--color-text-secondary)">
          Please sign in to view this submission.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-(--color-bg-primary)">
        <LoadingSpinner message="Loading submission..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-(--color-bg-primary)">
        <p className="text-sm text-(--color-danger)">
          {error}
        </p>
      </div>
    );
  }

  if (!submission || !challenge) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-(--color-bg-primary)">
        <p className="text-sm text-(--color-text-secondary)">
          {submissionId ? 'Submission not found.' : `No submission found for ${formattedDate}.`}
        </p>
      </div>
    );
  }

  // Privacy: don't show other users' submissions for today until viewer has submitted
  const isTodaySubmission = submission.challenge_date === todayStr;
  if (!isOwnSubmission && isTodaySubmission) {
    // Still checking — show spinner instead of flashing the submission
    if (!hasCheckedSubmission) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 bg-(--color-bg-primary)">
          <LoadingSpinner message="Loading submission..." />
        </div>
      );
    }
    if (!hasSubmittedToday) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 bg-(--color-bg-primary)">
          <p className="text-sm text-(--color-text-secondary) text-center leading-relaxed">
            Submit your art today to view this submission.
          </p>
        </div>
      );
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 theme-pattern bg-(--color-bg-primary)">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold mb-1 text-(--color-text-primary) font-display">
              {formattedDate}
            </h1>
            <div className="flex items-center gap-2 text-sm">
              {nickname && submission?.user_id ? (
                <>
                  <Link
                    href={`?view=profile&user=${submission.user_id}`}
                    className="flex items-center gap-2 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors"
                  >
                    <AvatarImage avatarUrl={avatarUrl} initial={(nickname || 'U')[0].toUpperCase()} size="sm" />
                    {nickname}
                  </Link>
                  {user && user.id !== submission.user_id && (
                    <FollowButton targetUserId={submission.user_id} />
                  )}
                </>
              ) : (
                <span className="text-(--color-text-secondary)">Daily Challenge Submission</span>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-col md:flex-row gap-5 items-start justify-center">
            {/* Canvas and actions */}
            <div className="flex flex-col gap-3">
              <div
                className="overflow-hidden w-fit"
                style={{
                  border: 'var(--border-width-heavy, 3px) solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <SubmissionCanvas
                  shapes={submission.shapes}
                  groups={submission.groups}
                  backgroundColor={submission.background_color}
                  svgRef={svgRef}
                />
              </div>
              {/* Like button with likers tooltip */}
              <div className="flex items-center pt-1">
                <LikersTooltip
                  likers={likers}
                  totalCount={likeCount}
                  onViewAll={() => setShowLikersModal(true)}
                >
                  <CardLikeButton
                    isLiked={isLiked}
                    likeCount={likeCount}
                    disabled={isOwnSubmission}
                    size="lg"
                    onToggle={handleLikeToggle}
                  />
                </LikersTooltip>
              </div>
            </div>

            {/* Info sidebar */}
            <div className="space-y-3 w-full md:w-72">
              <ChallengeDetailsCard challenge={challenge} submissionShapes={submission.shapes} />
              {rankInfo && <RankingCard rankInfo={rankInfo} />}
              <SubmissionStatsCard submission={submission} />
              <ExportActionsCard
                onDownloadPNG={downloadPNG}
                onDownloadSVG={downloadSVG}
                onCopyLink={copyShareLink}
                showDownloadButtons={!submissionId}
              />
            </div>
          </div>
        </div>
      {showLoginModal && (
        <LoginPromptModal
          onClose={() => setShowLoginModal(false)}
          title="Sign In to Like"
          message="You need to be logged in to like submissions."
        />
      )}
      {showLikersModal && (
        <LikersModal
          likers={likers}
          onClose={() => setShowLikersModal(false)}
        />
      )}
    </div>
  );
}
