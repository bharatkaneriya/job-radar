import mongoose from 'mongoose';
import { DEFAULT_SOURCES } from '../services/defaults.js';

const settingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    sources: { type: mongoose.Schema.Types.Mixed, default: () => structuredClone(DEFAULT_SOURCES) },
  },
  { timestamps: true, minimize: false }
);

// Sources added to DEFAULT_SOURCES after the doc was created show up with their defaults.
settingSchema.statics.load = async function () {
  const doc = (await this.findById('global')) || (await this.create({ _id: 'global' }));
  doc.sources = { ...structuredClone(DEFAULT_SOURCES), ...doc.sources };
  return doc;
};

export const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
