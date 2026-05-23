"use client";

/**
 * Tampilkan tanggal hari ini menggunakan timezone browser user.
 * Dipakai di Server Component yang tidak bisa akses timezone client.
 */
export function TodayDate() {
  return (
    <span suppressHydrationWarning>
      {new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })}
    </span>
  );
}
