"use client";

import { useState } from "react";
import { useLotteryActivity } from "@/src/hooks/use-lottery-activity";

const PAGE_SIZE = 10;

export function LotteryActivity() {
  const {
    activities,
    isConfigured,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useLotteryActivity();

  const [pagination, setPagination] = useState({
    activityCount: activities.length,
    visibleCount: PAGE_SIZE,
  });

  const visibleCount =
    pagination.activityCount === activities.length
      ? pagination.visibleCount
      : PAGE_SIZE;

  const visibleActivities = activities.slice(0, visibleCount);
  const hasMore = visibleCount < activities.length;

  return (
    <section className="mx-auto mt-20 max-w-5xl px-5">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
            On-chain activity
          </p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            Lottery activity
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Verifiable events recorded by the LuckyChain smart contract.
          </p>
        </div>

        {isConfigured && (
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-gray-300 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {isFetching ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
        {!isConfigured ? (
          <div className="py-8 text-center">
            <p className="font-semibold text-gray-300">
              Activity history unavailable
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Contract deployment and deployment block configuration are
              required to retrieve on-chain events.
            </p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4 py-4" aria-label="Loading activity">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-xl bg-white/[0.04] p-5"
              >
                <div className="h-3 w-32 rounded bg-white/10" />
                <div className="mt-3 h-3 w-3/4 rounded bg-white/[0.07]" />
              </div>
            ))}
          </div>
        ) : error && activities.length === 0 ? (
          <div role="alert" className="py-8 text-center">
            <p className="font-semibold text-red-400">
              Unable to load lottery activity
            </p>
            <p className="mt-2 text-sm text-gray-500">
              The activity service could not retrieve on-chain events.
              Please check the Sepolia connection and try again.
            </p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/[0.06] disabled:opacity-50"
            >
              {isFetching ? "Retrying..." : "Try again"}
            </button>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-semibold text-gray-300">
              No activity found
            </p>
            <p className="mt-2 text-sm text-gray-500">
              No supported lottery events have been recorded yet.
            </p>
          </div>
        ) : (
          <>
            {error && activities.length > 0 && (
              <div
                role="status"
                className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-300"
              >
                Refresh failed. Showing previously retrieved activity.
              </div>
            )}

            <div className="divide-y divide-white/[0.07]">
              {visibleActivities.map((activity) => (
                <article
                  key={activity.id}
                  className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {activity.eventName}
                    </p>
                    <p className="mt-1 break-all text-sm leading-6 text-gray-400">
                      {activity.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-600">
                      Block {activity.blockNumber.toString()}
                    </p>
                  </div>

                  <a
                    href={`https://sepolia.etherscan.io/tx/${activity.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-semibold text-violet-300 transition hover:text-violet-200"
                  >
                    View transaction ↗
                  </a>
                </article>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
              <p className="text-xs text-gray-500">
                Showing {visibleActivities.length} of {activities.length} events
              </p>

              {hasMore && (
                <button
                  onClick={() =>
                    setPagination({
                      activityCount: activities.length,
                      visibleCount: visibleCount + PAGE_SIZE,
                    })
                  }
                  className="rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20"
                >
                  Load more
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
