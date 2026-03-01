import { AlertTriangle,Clock,Edit2,Package,Trash2 } from 'lucide-react';
import React from 'react';
import { Skeleton,SkeletonStats,SkeletonTableRow } from '../../../components/Skeleton';
import { formatStockDisplay } from '../../../services/liquidInventoryService';
import { Part } from '../../../types';

interface PartsTableProps {
  groupedParts: Record<string, Part[]>;
  loading: boolean;
  isAdmin: boolean;
  canViewPricing?: boolean;
  onEdit: (part: Part) => void;
  onDelete: (part: Part) => void;
}

const PartsTable: React.FC<PartsTableProps> = ({
  groupedParts,
  loading,
  isAdmin,
  canViewPricing = true,
  onEdit,
  onDelete,
}) => {
  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonStats count={4} />
        <div className="card-theme rounded-xl overflow-hidden theme-transition">
          <div className="bg-theme-surface-2 px-4 py-3 border-b border-theme">
            <Skeleton width={120} height={20} className="mb-1" />
            <Skeleton width={80} height={14} />
          </div>
          <table className="w-full">
            <thead className="bg-theme-surface-2">
              <tr>
                {['Code', 'Name', ...(canViewPricing ? ['Cost', 'Sell'] : []), 'Warranty', 'Stock', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-theme-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} columns={canViewPricing ? 7 : 5} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (Object.keys(groupedParts).length === 0) {
    return (
      <div className="card-theme rounded-xl p-12 text-center theme-transition">
        <Package className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-theme mb-2">No parts found</h3>
        <p className="text-sm text-theme-muted">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <>
      {Object.keys(groupedParts).sort().map(category => (
        <div key={category} className="card-theme rounded-xl overflow-hidden theme-transition">
          <div className="bg-theme-surface-2 px-3 md:px-4 py-3 border-b border-theme">
            <h2 className="font-semibold text-theme text-sm md:text-base">{category}</h2>
            <p className="text-xs text-theme-muted">{groupedParts[category].length} items</p>
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-theme-surface-2 text-theme-muted text-xs uppercase">
                <tr>
                  <th className="p-4">Part Name</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Stock</th>
                  {canViewPricing && <th className="p-4">Cost (RM)</th>}
                  {canViewPricing && <th className="p-4">Price (RM)</th>}
                  <th className="p-4">Warranty</th>
                  <th className="p-4">Last Updated By</th>
                  {isAdmin && <th className="p-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {groupedParts[category].map(p => (
                  <tr key={p.part_id} className="hover:bg-theme-surface-2 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-theme">{p.part_name}</div>
                      {p.supplier && (
                        <div className="text-xs text-theme-muted">Supplier: {p.supplier}</div>
                      )}
                      {p.location && (
                        <div className="text-xs text-theme-muted">Location: {p.location}</div>
                      )}
                    </td>
                    <td className="p-4 text-theme-muted text-sm font-mono">{p.part_code}</td>
                    <td className="p-4">
                      <div className={`font-bold flex items-center gap-2 ${
                        (p.is_liquid ? ((p.container_quantity || 0) * (p.container_size || 0) + (p.bulk_quantity || 0)) === 0 : p.stock_quantity === 0) ? 'text-red-500' :
                        (p.is_liquid ? ((p.container_quantity || 0) * (p.container_size || 0) + (p.bulk_quantity || 0)) <= (p.min_stock_level || 10) : p.stock_quantity <= (p.min_stock_level || 10)) ? 'text-amber-500' :
                        'text-green-600'
                      }`}>
                        {p.is_liquid ? formatStockDisplay(p) : p.stock_quantity}
                        {(p.is_liquid ? ((p.container_quantity || 0) * (p.container_size || 0) + (p.bulk_quantity || 0)) === 0 : p.stock_quantity === 0) && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">OUT</span>
                        )}
                        {!(p.is_liquid ? ((p.container_quantity || 0) * (p.container_size || 0) + (p.bulk_quantity || 0)) === 0 : p.stock_quantity === 0) &&
                          (p.is_liquid ? ((p.container_quantity || 0) * (p.container_size || 0) + (p.bulk_quantity || 0)) <= (p.min_stock_level || 10) : p.stock_quantity <= (p.min_stock_level || 10)) && (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                      </div>
                      <div className="text-xs text-theme-muted">Min: {p.min_stock_level || 10}</div>
                    </td>
                    {canViewPricing && <td className="p-4 text-slate-600">{p.cost_price.toFixed(2)}</td>}
                    {canViewPricing && <td className="p-4 font-medium">{p.sell_price.toFixed(2)}</td>}
                    <td className="p-4 text-slate-500 text-sm">{p.warranty_months} mo</td>
                    <td className="p-4">
                      {p.last_updated_by_name ? (
                        <div>
                          <div className="text-sm text-slate-700">{p.last_updated_by_name}</div>
                          {p.updated_at && (
                            <div className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(p.updated_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => onEdit(p)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(p)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-theme">
            {groupedParts[category].map(p => (
              <div key={p.part_id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-theme text-sm truncate">{p.part_name}</div>
                    <div className="text-xs text-theme-muted font-mono">{p.part_code}</div>
                  </div>
                  <div className={`text-lg font-bold flex items-center gap-1 flex-shrink-0 ${
                    (p.is_liquid ? ((p.container_quantity || 0) * (p.container_size || 0) + (p.bulk_quantity || 0)) === 0 : p.stock_quantity === 0) ? 'text-red-500' :
                    (p.is_liquid ? ((p.container_quantity || 0) * (p.container_size || 0) + (p.bulk_quantity || 0)) <= (p.min_stock_level || 10) : p.stock_quantity <= (p.min_stock_level || 10)) ? 'text-amber-500' :
                    'text-green-600'
                  }`}>
                    {p.is_liquid ? formatStockDisplay(p) : p.stock_quantity}
                    {(p.is_liquid ? ((p.container_quantity || 0) * (p.container_size || 0) + (p.bulk_quantity || 0)) === 0 : p.stock_quantity === 0) && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">OUT</span>
                    )}
                    {!(p.is_liquid ? ((p.container_quantity || 0) * (p.container_size || 0) + (p.bulk_quantity || 0)) === 0 : p.stock_quantity === 0) &&
                      (p.is_liquid ? ((p.container_quantity || 0) * (p.container_size || 0) + (p.bulk_quantity || 0)) <= (p.min_stock_level || 10) : p.stock_quantity <= (p.min_stock_level || 10)) && (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-theme-muted">
                  {canViewPricing && <span>Cost: RM{p.cost_price.toFixed(2)}</span>}
                  {canViewPricing && <span>Price: RM{p.sell_price.toFixed(2)}</span>}
                  <span>{p.warranty_months} mo warranty</span>
                  <span>Min: {p.min_stock_level || 10}</span>
                </div>
                {(p.supplier || p.location) && (
                  <div className="flex flex-wrap gap-x-3 text-xs text-theme-muted">
                    {p.supplier && <span>Supplier: {p.supplier}</span>}
                    {p.location && <span>Location: {p.location}</span>}
                  </div>
                )}
                {isAdmin && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onEdit(p)}
                      className="flex items-center gap-1.5 px-3 py-2 h-10 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-medium"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => onDelete(p)}
                      className="flex items-center gap-1.5 px-3 py-2 h-10 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

export default PartsTable;
