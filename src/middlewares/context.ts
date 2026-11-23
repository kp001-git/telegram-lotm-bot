import { Context } from "grammy";
import { HydrateFlavor } from "@grammyjs/hydrate";
import { BeyonderRole, DbUser } from "../database/repositories/user.repository";

export interface CustomContextFields {
  memberRole: BeyonderRole;
  dbUser?: DbUser | null;
}

export type MyContext = HydrateFlavor<Context> & CustomContextFields;
