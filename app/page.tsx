"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";

export default function MLBErrorTracker() {
  const [liveErrors, setLiveErrors] = useState([]);
  const [yesterdayErrors, setYesterdayErrors] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  function getDateString(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  }

  useEffect(() => {
    const seenLive = new Set();
    const seenYesterday = new Set();

    async function fetchGames(date) {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`
      );
      const json = await res.json();
      return json?.dates?.[0]?.games?.map((g) => ({
        id: g.gamePk,
        home: g.teams.home.team.name,
        away: g.teams.away.team.name,
      })) || [];
    }

    async function checkErrors(game, seenSet) {
      const url = `https://statsapi.mlb.com/api/v1.1/game/${game.id}/feed/live`;
      const res = await fetch(url);
      const data = await res.json();
      const allPlays = data?.liveData?.plays?.allPlays || [];

      const newErrors = allPlays.filter((play) => {
        const desc = play.result.description?.toLowerCase() || "";
        const event = play.result.event?.toLowerCase() || "";
        return (
          (desc.includes("error") || event.includes("error")) &&
          !seenSet.has(play.playId)
        );
      });

      newErrors.forEach((play) => seenSet.add(play.playId));

      return newErrors.map((play) => ({
        id: play.playId,
        inning: play.about.inning,
        description: play.result.description,
        game: `${game.away} @ ${game.home}`,
        time: new Date(play.about.startTime).toLocaleTimeString(),
        batter: play.matchup?.batter?.fullName || "Unknown",
      }));
    }

    async function pollErrors() {
      const today = getDateString(0);
      const yesterday = getDateString(-1);

      const [liveGames, ydayGames] = await Promise.all([
        fetchGames(today),
        fetchGames(yesterday),
      ]);

      let newLiveErrors = [];
      for (const game of liveGames) {
        const errors = await checkErrors(game, seenLive);
        newLiveErrors = [...newLiveErrors, ...errors];
      }

      let newYdayErrors = [];
      for (const game of ydayGames) {
        const errors = await checkErrors(game, seenYesterday);
        newYdayErrors = [...newYdayErrors, ...errors];
      }

      if (newLiveErrors.length > 0) setLiveErrors((prev) => [...newLiveErrors, ...prev]);
      if (newYdayErrors.length > 0) setYesterdayErrors((prev) => [...newYdayErrors, ...prev]);
      setLastUpdated(new Date().toLocaleTimeString());
    }

    const interval = setInterval(pollErrors, 30000);
    pollErrors();

    return () => clearInterval(interval);
  }, []);

  const renderErrors = (errors) =>
    errors.map((error) => (
      <Card key={error.id} className="mb-2">
        <CardContent>
          <p className="font-semibold">Game: {error.game}</p>
          <p className="text-sm text-gray-600">Time: {error.time}</p>
          <p className="text-sm text-gray-600">Batter: {error.batter}</p>
          <p className="mt-2">{error.description}</p>
        </CardContent>
      </Card>
    ));

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">⚾ MLB Error Tracker</h1>
      {lastUpdated && (
        <p className="text-sm mb-2 text-gray-500">
          Last checked at {lastUpdated}
        </p>
      )}
      <h2 className="text-xl font-semibold mt-6 mb-2">Live Games (Today)</h2>
      {liveErrors.length === 0 ? <p>No errors yet today.</p> : renderErrors(liveErrors)}

      <h2 className="text-xl font-semibold mt-6 mb-2">Yesterday’s Games</h2>
      {yesterdayErrors.length === 0 ? <p>No errors yesterday.</p> : renderErrors(yesterdayErrors)}
    </div>
  );
}
