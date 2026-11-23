import { MyContext } from "../../middlewares/context";
import { handleSubmission } from "./suggest";

export async function ideaCommand(ctx: MyContext): Promise<void> {
  await handleSubmission(ctx, "IDEA");
}
