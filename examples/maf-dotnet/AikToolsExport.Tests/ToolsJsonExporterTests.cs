using System.Text.Json;
using Microsoft.Extensions.AI;
using Xunit;

namespace AikToolsExport.Tests;

public class ToolsJsonExporterTests
{
    private static string FixturePath()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "fixtures", "tools.json")))
        {
            dir = dir.Parent;
        }
        return Path.Combine(
            dir?.FullName ?? throw new FileNotFoundException("fixtures/tools.json not found"),
            "fixtures",
            "tools.json");
    }

    private static JsonElement Tool(string name)
    {
        using var doc = JsonDocument.Parse(ToolsJsonExporter.Export(SampleTools.Create()));
        return doc.RootElement.GetProperty("tools").EnumerateArray()
            .First(tool => tool.GetProperty("name").GetString() == name).Clone();
    }

    [Fact]
    public void Export_of_the_sample_tools_matches_the_committed_fixture()
    {
        var expected = File.ReadAllText(FixturePath());

        Assert.Equal(expected, ToolsJsonExporter.Export(SampleTools.Create()));
    }

    [Fact]
    public void Invocable_functions_are_backend_tools_and_declarations_are_frontend_tools()
    {
        Assert.Equal("backend", Tool("getWeather").GetProperty("executionSide").GetString());
        Assert.Equal("frontend", Tool("confirmBooking").GetProperty("executionSide").GetString());
    }

    [Fact]
    public void Parameters_keep_enum_nullable_and_required_from_the_real_schema()
    {
        var parameters = Tool("getWeather").GetProperty("parameters");
        var properties = parameters.GetProperty("properties");

        Assert.Equal("object", parameters.GetProperty("type").GetString());
        Assert.Equal(
            new[] { "Celsius", "Fahrenheit" },
            properties.GetProperty("unit").GetProperty("enum").EnumerateArray().Select(v => v.GetString()));
        Assert.Equal(
            new[] { "integer", "null" },
            properties.GetProperty("days").GetProperty("type").EnumerateArray().Select(v => v.GetString()));
        Assert.Equal(
            new[] { "city" },
            parameters.GetProperty("required").EnumerateArray().Select(v => v.GetString()));
    }

    [Fact]
    public void Returns_carry_the_return_schema()
    {
        var returns = Tool("getWeather").GetProperty("returns");

        Assert.Equal("json", returns.GetProperty("format").GetString());
        Assert.Equal(
            new[] { "string", "null" },
            returns.GetProperty("schema").GetProperty("properties").GetProperty("note").GetProperty("type")
                .EnumerateArray().Select(v => v.GetString()));
    }

    [Fact]
    public void A_function_without_a_return_value_has_no_return_schema()
    {
        var returns = Tool("trackEvent").GetProperty("returns");

        Assert.Equal("json", returns.GetProperty("format").GetString());
        Assert.False(returns.TryGetProperty("schema", out _));
    }

    [Fact]
    public void Output_is_stable_across_platforms()
    {
        var json = ToolsJsonExporter.Export(SampleTools.Create());

        Assert.DoesNotContain("\r", json);
        Assert.EndsWith("}\n", json);
    }

    [Fact]
    public void Tools_that_are_not_functions_are_rejected_with_a_clear_message()
    {
        var error = Assert.Throws<ArgumentException>(() => ToolsJsonExporter.Export([new HostedWebSearchTool()]));

        Assert.Contains("HostedWebSearchTool", error.Message);
    }
}
