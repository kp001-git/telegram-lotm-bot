import { MyContext } from "../../middlewares/context";
import { handleSubmission } from "./suggest";

export async function reportCommand(ctx: MyContext): Promise<void> {
  await handleSubmission(ctx, "REPORT");
}
