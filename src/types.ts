import ignore from "ignore";

// Define the type for the ignore instance
export type IgnoreInstance = ReturnType<typeof ignore>;

// Define the type for minify file description callback
export type MinifyFileDescriptionCallback = (metadata: {
  filePath: string;
  displayPath: string;
  extension: string;
  fileType: string;
  defaultText: string;
}) => string;

// Type definitions for processed files
export type ProcessedFile = {
  fileName: string;
  content: string;
};
