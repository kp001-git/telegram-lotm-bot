import { getDatabaseClient } from "../client";

export type SubmissionType = "SUGGESTION" | "IDEA" | "REPORT";
export type SubmissionStatus = "PENDING" | "VOTING" | "APPROVED" | "REJECTED";
export type PollStatus = "OPEN" | "CLOSED";

export interface Submission {
  id: number;
  user_id: number;
  type: SubmissionType;
  content: string;
  status: SubmissionStatus;
  reviewed_by: number | null;
  created_at: string;
}

export interface ApprovedSubmission extends Submission {
  author_first_name?: string | null;
  author_username?: string | null;
}

export interface Poll {
  id: number;
  chat_id: number;
  suggestion_id: number | null;
  question: string;
  options_json: string;
  status: PollStatus;
  created_by: number;
  message_id: number | null;
  created_at: string;
}

export interface PollOptionTally {
  index: number;
  text: string;
  count: number;
  percentage: number;
}

export interface PollWithTallies extends Poll {
  options: string[];
  totalVotes: number;
  tallies: PollOptionTally[];
}

export class GovernanceRepository {
  private client = getDatabaseClient();

  async createSubmission(
    userId: number,
    type: SubmissionType,
    content: string
  ): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.client.execute({
      sql: `
        INSERT INTO suggestions (user_id, type, content, status, reviewed_by, created_at)
        VALUES (?, ?, ?, 'PENDING', NULL, ?)
        RETURNING id;
      `,
      args: [userId, type, content, now],
    });

    return Number(result.rows[0].id);
  }

  async getSubmissionById(id: number): Promise<Submission | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM suggestions WHERE id = ? LIMIT 1;`,
      args: [id],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as Submission;
  }

  async updateSubmissionStatus(
    id: number,
    status: SubmissionStatus,
    reviewedBy?: number
  ): Promise<void> {
    await this.client.execute({
      sql: `
        UPDATE suggestions 
        SET status = ?, reviewed_by = COALESCE(?, reviewed_by)
        WHERE id = ?;
      `,
      args: [status, reviewedBy ?? null, id],
    });
  }

  async getApprovedSuggestions(limit = 15): Promise<ApprovedSubmission[]> {
    const result = await this.client.execute({
      sql: `
        SELECT s.*, u.first_name as author_first_name, u.username as author_username
        FROM suggestions s
        LEFT JOIN users u ON s.user_id = u.user_id
        WHERE s.status = 'APPROVED'
        ORDER BY s.id DESC
        LIMIT ?;
      `,
      args: [limit],
    });

    return result.rows as unknown as ApprovedSubmission[];
  }

  async createPoll(
    chatId: number,
    question: string,
    options: string[],
    createdBy: number,
    suggestionId?: number,
    messageId?: number
  ): Promise<number> {
    const now = new Date().toISOString();
    const optionsJson = JSON.stringify(options);

    const result = await this.client.execute({
      sql: `
        INSERT INTO polls (chat_id, suggestion_id, question, options_json, status, created_by, message_id, created_at)
        VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?)
        RETURNING id;
      `,
      args: [
        chatId,
        suggestionId ?? null,
        question,
        optionsJson,
        createdBy,
        messageId ?? null,
        now,
      ],
    });

    return Number(result.rows[0].id);
  }

  async updatePollMessageId(pollId: number, messageId: number): Promise<void> {
    await this.client.execute({
      sql: `UPDATE polls SET message_id = ? WHERE id = ?;`,
      args: [messageId, pollId],
    });
  }

  async getPollById(pollId: number): Promise<Poll | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM polls WHERE id = ? LIMIT 1;`,
      args: [pollId],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as Poll;
  }

  async castVote(pollId: number, userId: number, optionIndex: number): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `
        INSERT INTO poll_votes (poll_id, user_id, option_index, voted_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(poll_id, user_id) DO UPDATE SET
          option_index = excluded.option_index,
          voted_at = excluded.voted_at;
      `,
      args: [pollId, userId, optionIndex, now],
    });
  }

  async closePoll(pollId: number): Promise<void> {
    await this.client.execute({
      sql: `UPDATE polls SET status = 'CLOSED' WHERE id = ?;`,
      args: [pollId],
    });
  }

  async getPollWithTallies(pollId: number): Promise<PollWithTallies | null> {
    const poll = await this.getPollById(pollId);
    if (!poll) return null;

    let options: string[] = [];
    try {
      options = JSON.parse(poll.options_json);
    } catch {
      options = ["For", "Against"];
    }

    // Get count per option
    const votesResult = await this.client.execute({
      sql: `
        SELECT option_index, COUNT(*) as vote_count
        FROM poll_votes
        WHERE poll_id = ?
        GROUP BY option_index;
      `,
      args: [pollId],
    });

    const countMap = new Map<number, number>();
    let totalVotes = 0;

    for (const row of votesResult.rows) {
      const idx = Number(row.option_index);
      const cnt = Number(row.vote_count);
      countMap.set(idx, cnt);
      totalVotes += cnt;
    }

    const tallies: PollOptionTally[] = options.map((text, index) => {
      const count = countMap.get(index) || 0;
      const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      return {
        index,
        text,
        count,
        percentage,
      };
    });

    return {
      ...poll,
      options,
      totalVotes,
      tallies,
    };
  }

  async getActivePolls(chatId: number): Promise<PollWithTallies[]> {
    const result = await this.client.execute({
      sql: `SELECT id FROM polls WHERE chat_id = ? AND status = 'OPEN' ORDER BY id DESC;`,
      args: [chatId],
    });

    const polls: PollWithTallies[] = [];
    for (const row of result.rows) {
      const pollWithTallies = await this.getPollWithTallies(Number(row.id));
      if (pollWithTallies) {
        polls.push(pollWithTallies);
      }
    }

    return polls;
  }
}

export const governanceRepository = new GovernanceRepository();
