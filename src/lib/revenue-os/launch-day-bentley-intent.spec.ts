import { parseLaunchExecutionIntent } from "./launch-day-bentley-intent";

describe("parseLaunchExecutionIntent", () => {
  it("parses do day N", () => {
    expect(parseLaunchExecutionIntent("do day 1")).toEqual({ type: "day", day: 1 });
    expect(parseLaunchExecutionIntent("Start day 7")).toEqual({ type: "day", day: 7 });
  });

  it("parses what should I do for day 4", () => {
    expect(parseLaunchExecutionIntent("what should I do for day 4")).toEqual({ type: "day", day: 4 });
  });

  it("parses general execute launch mode", () => {
    expect(parseLaunchExecutionIntent("help me execute launch mode")).toEqual({ type: "general_execute" });
  });

  it("maps content day to 3", () => {
    expect(parseLaunchExecutionIntent("take me to content day")).toEqual({ type: "day", day: 3 });
  });

  it("returns none for unrelated", () => {
    expect(parseLaunchExecutionIntent("open dashboard")).toEqual({ type: "none" });
  });
});
