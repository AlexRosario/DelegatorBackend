-- CreateIndex
CREATE INDEX "Bill_congress_latestActionDate_id_idx" ON "Bill"("congress", "latestActionDate", "id");

-- CreateIndex
CREATE INDEX "Bill_congress_stage_idx" ON "Bill"("congress", "stage");
