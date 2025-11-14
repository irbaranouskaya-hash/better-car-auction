import { Router, type Request, type Response } from "express";

const router = Router();


router.post("/", (req: Request, res: Response) => {
  // TODO: add logic of creating auction
  res.status(201).json({
    message: "Auction created successfully",
    // auction: createdAuction
  });
});


router.get("/", (req: Request, res: Response) => {
  // TODO: add getting all auctions with filtering
  res.json({
    message: "Get all auctions",
    // auctions: []
  });
});

router.get("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  // TODO: add getting auction by id
  res.json({
    message: `Get auction with id: ${id}`,
    // auction: foundAuction
  });
});


router.put("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  // TODO: add updating auction
  res.json({
    message: `Update auction with id: ${id}`,
    // auction: updatedAuction
  });
});

router.delete("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  // TODO: add deleting auction
  res.json({
    message: `Delete auction with id: ${id}`,
  });
});

export default router;
