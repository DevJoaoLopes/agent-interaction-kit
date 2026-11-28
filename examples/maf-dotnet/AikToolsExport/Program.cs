using AikToolsExport;

// Usage: dotnet run --project AikToolsExport -- [output-path]
// Writes the tools-json for SampleTools. Replace SampleTools.Create() with your agent's tools.
var json = ToolsJsonExporter.Export(SampleTools.Create());

if (args.Length > 0)
{
    File.WriteAllText(args[0], json);
}
else
{
    Console.Out.Write(json);
}
