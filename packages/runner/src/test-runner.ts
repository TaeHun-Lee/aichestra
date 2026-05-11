export type TestRunInput = {
  taskId: string;
  commands: string[];
  changedFiles: string[];
  prompt: string;
};

export type TestRunResult = {
  passed: boolean;
  command: string;
  output: string;
};

export type TestRunner = {
  run(input: TestRunInput): Promise<TestRunResult>;
};

export class MockTestRunner implements TestRunner {
  async run(input: TestRunInput): Promise<TestRunResult> {
    const command = input.commands[0] ?? "mock test";
    const passed = !/\b(mock-fail|force-fail|fail-task)\b/.test(input.prompt.toLowerCase());

    return {
      passed,
      command,
      output: passed
        ? `Mock tests passed for ${input.changedFiles.length} changed file(s).`
        : `Mock tests failed for ${input.taskId}.`
    };
  }
}
