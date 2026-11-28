using System.Text;
using System.Text.Json;
using Microsoft.Extensions.AI;

namespace AikToolsExport;

/// <summary>
/// Serializes the tools of a Microsoft Agent Framework agent (any <see cref="AITool"/> list, such as
/// <c>ChatClientAgent</c> tools or <c>ChatOptions.Tools</c>) to the generic tools-json format read by
/// <c>aik manifest --from tools-json</c>.
/// </summary>
public static class ToolsJsonExporter
{
    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Indented = true,
        NewLine = "\n",
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>
    /// An invocable <see cref="AIFunction"/> runs on the backend. A declaration-only
    /// <see cref="AIFunctionDeclaration"/> (for example from <c>AsDeclarationOnly()</c>) is a tool the client runs.
    /// </summary>
    public static string Export(IEnumerable<AITool> tools)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, WriterOptions))
        {
            writer.WriteStartObject();
            writer.WriteStartArray("tools");
            foreach (var tool in tools)
            {
                WriteTool(writer, tool);
            }
            writer.WriteEndArray();
            writer.WriteEndObject();
        }
        return Encoding.UTF8.GetString(stream.ToArray()) + "\n";
    }

    private static void WriteTool(Utf8JsonWriter writer, AITool tool)
    {
        if (tool is not AIFunctionDeclaration declaration)
        {
            throw new ArgumentException(
                $"Tool \"{tool.Name}\" is a {tool.GetType().Name}, which has no JSON Schema. Only AIFunction and AIFunctionDeclaration tools can be exported.",
                nameof(tool));
        }

        writer.WriteStartObject();
        writer.WriteString("name", declaration.Name);
        if (!string.IsNullOrEmpty(declaration.Description))
        {
            writer.WriteString("description", declaration.Description);
        }
        writer.WriteString("executionSide", tool is AIFunction ? "backend" : "frontend");
        writer.WritePropertyName("parameters");
        declaration.JsonSchema.WriteTo(writer);
        writer.WriteStartObject("returns");
        writer.WriteString("format", "json");
        if (declaration.ReturnJsonSchema is { } returnSchema)
        {
            writer.WritePropertyName("schema");
            returnSchema.WriteTo(writer);
        }
        writer.WriteEndObject();
        writer.WriteEndObject();
    }
}
