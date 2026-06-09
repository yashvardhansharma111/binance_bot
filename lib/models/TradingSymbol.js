import mongoose from 'mongoose';

const TradingSymbolSchema = new mongoose.Schema({
  symbol:    { type: String, required: true, unique: true, uppercase: true },
  isEnabled: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.TradingSymbol || mongoose.model('TradingSymbol', TradingSymbolSchema);
