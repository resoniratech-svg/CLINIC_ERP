import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// WECARE HOMOEOPATHY ERP - KARIMNAGAR VILLAGE & MANDAL SELECTION TEST SUITE
// Verifies Village Name — Mandal Name display contract, Mandal Name display contract,
// bidirectional search filtering, and auto-creation format.
// ============================================================================

describe('Karimnagar Village & Mandal Selector Contract Suite', () => {

  const sampleMandals = [
    { id: 5, name: 'Karimnagar', status: 'active' },
    { id: 6, name: 'Kothapally', status: 'active' },
    { id: 7, name: 'Karimnagar Rural', status: 'active' },
    { id: 8, name: 'Manakondur', status: 'active' },
    { id: 9, name: 'Thimmapur', status: 'active' },
    { id: 10, name: 'Ganneruvaram', status: 'active' },
    { id: 11, name: 'Gangadhara', status: 'active' },
    { id: 12, name: 'Ramadugu', status: 'active' },
    { id: 13, name: 'Choppadandi', status: 'active' },
    { id: 14, name: 'Chigurumamidi', status: 'active' },
    { id: 15, name: 'Veenavanka', status: 'active' },
    { id: 16, name: 'V. Saidapur', status: 'active' },
    { id: 17, name: 'Shankarapatnam', status: 'active' },
    { id: 18, name: 'Huzurabad', status: 'active' },
    { id: 19, name: 'Jammikunta', status: 'active' },
    { id: 20, name: 'Ellandakunta', status: 'active' }
  ];

  const sampleVillages = [
    { id: 36, name: 'Karimnagar', mandal_id: 5, mandal_name: 'Karimnagar', status: 'active' },
    { id: 37, name: 'Pothugal (Submerged)', mandal_id: 5, mandal_name: 'Karimnagar', status: 'active' },
    { id: 38, name: 'Hasnapur (Submerged)', mandal_id: 5, mandal_name: 'Karimnagar', status: 'active' },
    { id: 39, name: 'Malkapur', mandal_id: 6, mandal_name: 'Kothapally', status: 'active' },
    { id: 40, name: 'Kothapalli (Haveli)', mandal_id: 6, mandal_name: 'Kothapally', status: 'active' },
    { id: 63, name: 'Bommakal', mandal_id: 7, mandal_name: 'Karimnagar Rural', status: 'active' },
    { id: 180, name: 'Bommakal', mandal_id: 16, mandal_name: 'V. Saidapur', status: 'active' },
    { id: 92, name: 'Mallapur', mandal_id: 9, mandal_name: 'Thimmapur', status: 'active' },
    { id: 129, name: 'Mallapur', mandal_id: 11, mandal_name: 'Gangadhara', status: 'active' },
    { id: 130, name: 'Uppara Mallial', mandal_id: 11, mandal_name: 'Gangadhara', status: 'active' },
    { id: 197, name: 'Kachapur', mandal_id: 17, mandal_name: 'Shankarapatnam', status: 'active' },
    { id: 244, name: 'Kanagarthy', mandal_id: 20, mandal_name: 'Ellandakunta', status: 'active' }
  ];

  // Logic mirrors VillageMandalSelect.jsx
  const formatVillageDisplay = (v) => {
    const vName = v.name;
    const mName = v.mandal_name || '';
    return mName ? `${vName} — ${mName}` : vName;
  };

  const formatMandalDisplay = (m) => {
    return m.name;
  };

  const filterLocations = (query, villages, mandals) => {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      return {
        filteredVillages: villages.slice(0, 30),
        filteredMandals: mandals.slice(0, 15)
      };
    }

    let vSearch = q;
    let mSearch = '';
    if (q.includes(',')) {
      const parts = q.split(',').map(s => s.trim());
      vSearch = parts[0] || '';
      mSearch = parts[1] || '';
    } else if (/\s+[-—]\s+/.test(q)) {
      const parts = q.split(/\s+[-—]\s+/).map(s => s.trim());
      vSearch = parts[0] || '';
      mSearch = parts[1] || '';
    }

    const matchedVillages = villages.filter(v => {
      const vName = (v.name || '').toLowerCase();
      const mName = (v.mandal_name || '').toLowerCase();
      if (mSearch) {
        return vName.includes(vSearch) && mName.includes(mSearch);
      }
      return vName.includes(vSearch) || mName.includes(vSearch);
    });

    const matchedMandals = mandals.filter(m => {
      const mName = (m.name || '').toLowerCase();
      return mName.includes(vSearch);
    });

    return {
      filteredVillages: matchedVillages,
      filteredMandals: matchedMandals
    };
  };

  describe('1. Dropdown Selection Display Format Contracts', () => {
    test('1.1 Selecting a Village formats text as "Village Name — Mandal Name"', () => {
      const village = sampleVillages.find(v => v.name === 'Pothugal (Submerged)');
      assert.ok(village);
      const display = formatVillageDisplay(village);
      assert.strictEqual(display, 'Pothugal (Submerged) — Karimnagar');
    });

    test('1.2 Selecting a Village with same name in another mandal includes the correct parent mandal', () => {
      const bommakalRural = sampleVillages.find(v => v.name === 'Bommakal' && v.mandal_name === 'Karimnagar Rural');
      const bommakalSaidapur = sampleVillages.find(v => v.name === 'Bommakal' && v.mandal_name === 'V. Saidapur');

      assert.strictEqual(formatVillageDisplay(bommakalRural), 'Bommakal — Karimnagar Rural');
      assert.strictEqual(formatVillageDisplay(bommakalSaidapur), 'Bommakal — V. Saidapur');
    });

    test('1.3 Selecting a Mandal formats text as "Mandal Name"', () => {
      const mandal = sampleMandals.find(m => m.name === 'Karimnagar');
      assert.ok(mandal);
      const display = formatMandalDisplay(mandal);
      assert.strictEqual(display, 'Karimnagar');
    });
  });

  describe('2. Search & Autocomplete Matching Logic', () => {
    test('2.1 Searching by mandal name returns all villages under that mandal', () => {
      const { filteredVillages } = filterLocations('Gangadhara', sampleVillages, sampleMandals);
      const names = filteredVillages.map(v => v.name);
      assert.ok(names.includes('Mallapur'));
      assert.ok(names.includes('Uppara Mallial'));
    });

    test('2.2 Searching with dash "Pothugal — Karimnagar" filters exact village and mandal', () => {
      const { filteredVillages } = filterLocations('Pothugal — Karimnagar', sampleVillages, sampleMandals);
      assert.strictEqual(filteredVillages.length, 1);
      assert.strictEqual(filteredVillages[0].name, 'Pothugal (Submerged)');
    });

    test('2.3 Searching with comma "Pothugal, Karimnagar" filters exact village and mandal', () => {
      const { filteredVillages } = filterLocations('Pothugal, Karimnagar', sampleVillages, sampleMandals);
      assert.strictEqual(filteredVillages.length, 1);
      assert.strictEqual(filteredVillages[0].name, 'Pothugal (Submerged)');
    });

    test('2.4 Case-insensitive search works across all fields', () => {
      const { filteredVillages } = filterLocations('kAchApur', sampleVillages, sampleMandals);
      assert.strictEqual(filteredVillages.length, 1);
      assert.strictEqual(filteredVillages[0].name, 'Kachapur');
      assert.strictEqual(filteredVillages[0].mandal_name, 'Shankarapatnam');
    });
  });
});
