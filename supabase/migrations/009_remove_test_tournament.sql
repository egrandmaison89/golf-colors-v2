-- Migration: Remove test tournament
-- Description: Clears the placeholder test tournament so real API data can populate

DELETE FROM tournaments WHERE sportsdata_id = 'test-1';
