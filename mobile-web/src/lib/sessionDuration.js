export function sessionDurationMinutes(startTime, endTime) {
    if (!startTime || !endTime)
        return null;
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite))
        return null;
    const start = startHour * 60 + startMinute;
    let end = endHour * 60 + endMinute;
    if (end < start)
        end += 24 * 60;
    return end - start;
}
