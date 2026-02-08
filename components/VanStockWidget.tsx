import {
AlertTriangle,
ChevronRight,
TrendingDown,
Truck
} from 'lucide-react';
import { useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { User,VanStock,VanStockItem } from '../types';

interface VanStockWidgetProps {
  currentUser: User;
}

export default function VanStockWidget({ currentUser }: VanStockWidgetProps) {
  const navigate = useNavigate();
  const [vanStock, setVanStock] = useState<VanStock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVanStock();
  }, [currentUser.user_id]);

  const loadVanStock = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getVanStockByTechnician(currentUser.user_id);
      setVanStock(data);
    } catch (error) {
      /* Silently ignore */
    }
    setLoading(false);
  };

  // Calculate stats
  const getStats = () => {
    if (!vanStock?.items) {
      return { total: 0, lowStock: 0, outOfStock: 0 };
    }
    const items = vanStock.items;
    return {
      total: items.length,
      lowStock: items.filter(item => item.quantity > 0 && item.quantity <= item.min_quantity).length,
      outOfStock: items.filter(item => item.quantity === 0).length,
    };
  };

  const stats = getStats();

  // Get critical items (out of stock or low)
  const getCriticalItems = (): VanStockItem[] => {
    if (!vanStock?.items) return [];
    return vanStock.items
      .filter(item => item.quantity <= item.min_quantity)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 3);
  };

  const criticalItems = getCriticalItems();

  if (loading) {
    return (
      <div className="card-theme rounded-xl p-4 theme-transition animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!vanStock) {
    return (
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-theme">Van Stock</h3>
        </div>
        <div className="text-center py-4">
          <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No Van Stock assigned</p>
        </div>
      </div>
    );
  }

  const hasAlerts = stats.lowStock > 0 || stats.outOfStock > 0;

  return (
    <div
      className={`card-theme rounded-xl p-4 theme-transition cursor-pointer hover:shadow-md ${
        hasAlerts ? 'border-l-4 border-l-amber-500' : ''
      }`}
      onClick={() => navigate('/my-van-stock')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-theme">Van Stock</h3>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 bg-slate-50 rounded-lg">
          <div className="text-lg font-bold text-slate-700">{stats.total}</div>
          <div className="text-xs text-slate-500">Items</div>
        </div>
        <div className={`text-center p-2 rounded-lg ${stats.lowStock > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
          <div className={`text-lg font-bold ${stats.lowStock > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {stats.lowStock}
          </div>
          <div className={`text-xs ${stats.lowStock > 0 ? 'text-amber-600' : 'text-slate-500'}`}>Low</div>
        </div>
        <div className={`text-center p-2 rounded-lg ${stats.outOfStock > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
          <div className={`text-lg font-bold ${stats.outOfStock > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {stats.outOfStock}
          </div>
          <div className={`text-xs ${stats.outOfStock > 0 ? 'text-red-600' : 'text-slate-500'}`}>Out</div>
        </div>
      </div>

      {/* Critical Items */}
      {criticalItems.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500 mb-1">Needs attention:</div>
          {criticalItems.map((item) => (
            <div
              key={item.item_id}
              className="flex items-center justify-between text-sm py-1 px-2 bg-slate-50 rounded"
            >
              <span className="truncate text-slate-700 flex-1 mr-2">
                {item.part?.part_name || 'Unknown'}
              </span>
              <span className={`font-medium ${
                item.quantity === 0 ? 'text-red-600' : 'text-amber-600'
              }`}>
                {item.quantity === 0 ? (
                  <span className="flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Out
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {item.quantity}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* No alerts message */}
      {!hasAlerts && (
        <div className="text-center py-2">
          <p className="text-sm text-green-600 font-medium">All stock levels OK</p>
        </div>
      )}
    </div>
  );
}
