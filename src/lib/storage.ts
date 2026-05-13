import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { Escrow } from "../types";

export class Storage {
  private filePath: string;

  constructor(filePath: string = join(process.cwd(), "data", "escrows.json")) {
    this.filePath = filePath;
    this.ensureDirectory();
  }

  private ensureDirectory() {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(this.filePath)) {
      writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  load(): Escrow[] {
    try {
      const data = readFileSync(this.filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Failed to load escrows:", error);
      return [];
    }
  }

  save(escrows: Escrow[]) {
    try {
      writeFileSync(this.filePath, JSON.stringify(escrows, null, 2));
    } catch (error) {
      console.error("Failed to save escrows:", error);
    }
  }

  findById(id: string): Escrow | undefined {
    return this.load().find((e) => e.id === id);
  }

  update(escrow: Escrow) {
    const escrows = this.load();
    const index = escrows.findIndex((e) => e.id === escrow.id);
    if (index !== -1) {
      escrows[index] = { ...escrow, updatedAt: Date.now() };
      this.save(escrows);
    }
  }

  add(escrow: Escrow) {
    const escrows = this.load();
    escrows.push(escrow);
    this.save(escrows);
  }
}
