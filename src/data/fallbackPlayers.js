export const fallbackPlayers = [
  ['4278073','Shai Gilgeous-Alexander','OKC','PG',32.7,5.0,6.4,1.7,1.0,2.4,51.9,89.8,2.1,99],
  ['4433134','Victor Wembanyama','SA','C',24.3,11.0,3.7,1.1,3.8,3.7,47.6,83.6,3.1,97],
  ['3945274','Nikola Jokic','DEN','C',29.6,12.7,10.2,1.8,0.6,3.4,57.6,80.0,2.0,98],
  ['4594268','Anthony Edwards','MIN','SG',27.6,5.7,4.5,1.2,0.7,3.2,44.7,83.7,4.1,94],
  ['3913176','Domantas Sabonis','SAC','C',19.1,14.1,6.1,0.7,0.4,3.0,59.0,75.4,0.9,91],
  ['3059318','Giannis Antetokounmpo','MIL','PF',30.4,11.9,6.5,0.9,1.2,3.4,60.1,61.7,0.2,96],
  ['3908809','Jayson Tatum','BOS','SF',26.8,8.7,6.0,1.1,0.5,2.9,45.2,81.4,3.5,93],
  ['4395628','Tyrese Haliburton','IND','PG',18.6,3.5,9.2,1.4,0.7,2.3,47.3,85.1,2.8,89],
  ['4066261','Luka Doncic','LAL','PG',28.2,8.2,7.7,1.8,0.4,3.8,45.0,78.2,3.4,95],
  ['3136193','Karl-Anthony Towns','NY','C',24.4,12.8,3.1,1.0,0.7,2.8,52.6,82.9,2.0,90],
  ['4395725','Trae Young','ATL','PG',24.2,3.1,11.6,1.2,0.2,4.7,41.1,87.5,2.9,88],
  ['4395627','Jalen Brunson','NY','PG',26.0,2.9,7.3,0.9,0.1,2.4,48.8,82.1,2.5,87],
].map(([id,name,team,position,pts,reb,ast,stl,blk,tov,fgPct,ftPct,threeMade,value]) => ({
  id,name,team,position,pts,reb,ast,stl,blk,tov,fgPct,ftPct,threeMade,value,gp:72,min:34.1,threePct:36.8,
  status:'active', age:null, teamName:team, teamLogo:`https://a.espncdn.com/i/teamlogos/nba/500/${team.toLowerCase()}.png`,
  headshot:`https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`,
  fantasyScore:Number((pts + reb*1.2 + ast*1.5 + stl*3 + blk*3 + threeMade*.8 + (fgPct-45)*.55 + (ftPct-75)*.22).toFixed(1)),
}))
