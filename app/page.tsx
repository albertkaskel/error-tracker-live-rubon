import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function MLBErrorTracker() {
  const [errors, setErrors] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const seen = new Set();

    async function fetchLiveGames() {
      const scheduleRes = await fetch(
        "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=today"
      );
      const schedule = await scheduleRes.json();
      const games = schedule?.dates?.[0]?.games || [];
      return games
        .filter((g) => g.status.abstractGameState !== "Final")
        .map((g) => g.gamePk);
    }

    async function checkErrors(gamePk) {
      const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
      const res = await fetch(url);
      const data = await res.json();
      const allPlays = data?.liveData?.plays?.allPlays || [];

      const newErrors = allPlays.filter((play) => {
        const desc = play.result.description?.toLowerCase() || "";
        const event = play.result.event?.toLowerCase() || "";
        return (
          (desc.includes("error") || event.includes("error")) &&
          !seen.has(play.playId)
        );
      });

      newErrors.forEach((play) => seen.add(play.playId));

      return newErrors.map((play) => ({
        id: play.playId,
        inning: play.about.inning,
        description: play.result.description,
      }));
    }

    async function pollErrors() {
      const gamePks = await fetchLiveGames();
      let allErrors = [];
      for (const pk of gamePks) {
        const errs = await checkErrors(pk);
        allErrors = [...allErrors, ...errs];
      }
      if (allErrors.length > 0) {
        setErrors((prev) => [...allErrors, ...prev]);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    }

    const interval = setInterval(pollErrors, 30000);
    pollErrors(); // Initial call

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">⚾ MLB Error Tracker</h1>
      {lastUpdated && (
        <p className="text-sm mb-2 text-gray-500">
          Last checked at {lastUpdated}
        </p>
      )}
      {errors.length === 0 ? (
        <p>No errors yet today! Check back soon.</p>
      ) : (
        errors.map((error) => (
          <Card key={error.id} className="mb-2">
            <CardContent>
              <p className="font-semibold">Inning: {error.inning}</p>
              <p>{error.description}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
