using System;
using System.IO;
using Windows.Storage.Streams;

// Windows PowerShell projects WinRT interface results as __ComObject, which
// prevents its overload binder from reaching IRandomAccessStream methods.
// A tiny strongly typed bridge keeps the metadata monitor dependency-free.
public static class GenrePoliceThumbnailReader
{
    public static byte[] Read(object projectedStream)
    {
        var randomAccessStream = projectedStream as IRandomAccessStreamWithContentType;
        if (randomAccessStream == null)
        {
            return Array.Empty<byte>();
        }

        using (Stream input = randomAccessStream.AsStreamForRead())
        using (var output = new MemoryStream())
        {
            input.CopyTo(output);
            return output.ToArray();
        }
    }

    public static string GetContentType(object projectedStream)
    {
        var randomAccessStream = projectedStream as IRandomAccessStreamWithContentType;
        return randomAccessStream == null ? string.Empty : randomAccessStream.ContentType;
    }
}
