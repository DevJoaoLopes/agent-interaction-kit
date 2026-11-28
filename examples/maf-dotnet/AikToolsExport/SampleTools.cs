using System.ComponentModel;
using Microsoft.Extensions.AI;

namespace AikToolsExport;

public enum TemperatureUnit
{
    Celsius,
    Fahrenheit,
}

public sealed record Weather(string City, double Temperature, TemperatureUnit Unit, string? Note);

public sealed record BookingDecision(bool Confirmed, string? Reason);

/// <summary>Example tools declared the way a Microsoft Agent Framework agent receives them.</summary>
public static class SampleTools
{
    [Description("Get the current weather for a city.")]
    public static Weather GetWeather(
        [Description("City name.")] string city,
        TemperatureUnit unit = TemperatureUnit.Celsius,
        [Description("Forecast horizon in days.")] int? days = null) =>
        new(city, 21.5, unit, days is null ? null : $"{days}-day outlook");

    [Description("Record an analytics event.")]
    public static void TrackEvent([Description("Event name.")] string name)
    {
    }

    [Description("Ask the user to confirm a booking.")]
    public static BookingDecision ConfirmBooking(
        [Description("Booking id.")] string bookingId,
        [Description("Optional note shown to the user.")] string? note = null) =>
        new(false, null);

    public static IReadOnlyList<AITool> Create() =>
    [
        AIFunctionFactory.Create(GetWeather, "getWeather"),
        AIFunctionFactory.Create(TrackEvent, "trackEvent"),
        // Declaration-only: the AG-UI client runs this tool, so the exporter marks it "frontend".
        AIFunctionFactory.Create(ConfirmBooking, "confirmBooking").AsDeclarationOnly(),
    ];
}
