import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FamilyWithMembers } from '@server/schema';
import { COURSE_OPTIONS } from '@/types/family';
import { getGradeGroupFirstChar } from '@/utils/grade-utils';
import { Users, Search, Edit, Copy, Phone, MessageSquare, MapPin, X, GraduationCap, Info } from 'lucide-react';
import styles from '../../pages/dashboards/dashboard.module.css';
import { CareLogList } from './CareLogList';

interface FamilyExpandedDetailsProps {
  family: FamilyWithMembers;
  onClose: () => void;
  onImageClick: (src: string, alt: string) => void;
  expandedGradeGroups: Set<string>;
  onToggleGradeGroup: (childId: string) => void;
  getStatusBorderClassName: (status: string) => string;
  getPrimaryCourses: (family: FamilyWithMembers) => { person: string; personName: string; courses: string[]; } | null;
  useCareLogsData: (familyId: string) => { data?: any[] };
}

export function FamilyExpandedDetails({
  family,
  onClose,
  onImageClick,
  expandedGradeGroups,
  onToggleGradeGroup,
  getStatusBorderClassName,
  getPrimaryCourses,
  useCareLogsData
}: FamilyExpandedDetailsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Component to display care log tab title with count
  const CareLogTabTitle = ({ familyId }: { familyId: string }) => {
    const { data: careLogs } = useCareLogsData(familyId);
    const careLogCount = careLogs?.length || 0;

    return (
      <div className="flex items-center gap-2">
        <span>Care Log</span>
        {careLogCount > 0 && (
          <span className="inline-flex items-center justify-center h-5 w-5 text-xs font-medium text-orange-700 bg-orange-100 border border-orange-200 rounded-full">
            {careLogCount > 9 ? '9+' : careLogCount}
          </span>
        )}
      </div>
    );
  };

  const handleCopyAddress = (fullAddress: string) => {
    navigator.clipboard.writeText(fullAddress);
    toast({
      description: "Address copied to clipboard",
    });
  };

  const renderFamilyPicture = () => (
    <div className="mb-6 flex justify-center">
      <div className="relative">
        {family.familyPicture ? (
          <div
            className="relative cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onImageClick(family.familyPicture!, `${family.familyName} family`);
            }}
          >
            <img
              src={family.familyPicture}
              alt={`${family.familyName} family`}
              className={`w-32 h-32 object-cover rounded-lg border-4 ${getStatusBorderClassName(family.memberStatus)} shadow-lg`}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.parentElement?.parentElement?.querySelector('.expanded-fallback-icon') as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1.5 hover:bg-opacity-70 transition-all">
              <Search className="w-4 h-4 text-white" />
            </div>
          </div>
        ) : (
          <div className={`w-32 h-32 rounded-lg border-4 ${getStatusBorderClassName(family.memberStatus)} shadow-lg bg-gray-100 flex items-center justify-center`}>
            <Users className="w-16 h-16 text-muted-foreground" />
          </div>
        )}
        <div className="expanded-fallback-icon hidden w-32 h-32 rounded-lg border-4 border-gray-300 shadow-lg bg-gray-100 items-center justify-center">
          <Users className="w-16 h-16 text-muted-foreground" />
        </div>
      </div>
    </div>
  );

  const renderContactInfo = () => {
    const husband = family.members.find(m => m.relationship === 'husband');
    const wife = family.members.find(m => m.relationship === 'wife');
    const hasPhoneNumber = husband?.phoneNumber || wife?.phoneNumber;

    return (
      <div className="flex flex-wrap gap-2">
        {hasPhoneNumber ? (
          <>
            {husband?.phoneNumber && (
              <>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer text-sm font-medium px-3 py-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`tel:${husband.phoneNumber}`, '_self');
                  }}
                  title="Click to call husband"
                >
                  <Phone className="h-3 w-3 mr-1" />
                  H: {husband.phoneNumber}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`sms:${husband.phoneNumber}`, '_self');
                  }}
                  title="Click to text husband"
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Text
                </Badge>
              </>
            )}
            {wife?.phoneNumber && (
              <>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer text-sm font-medium px-3 py-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`tel:${wife.phoneNumber}`, '_self');
                  }}
                  title="Click to call wife"
                >
                  <Phone className="h-3 w-3 mr-1" />
                  W: {wife.phoneNumber}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`sms:${wife.phoneNumber}`, '_self');
                  }}
                  title="Click to text wife"
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Text
                </Badge>
              </>
            )}
          </>
        ) : (
          <Badge variant="secondary" className="text-muted-foreground">
            <Phone className="h-3 w-3 mr-1" />
            No phone
          </Badge>
        )}
      </div>
    );
  };

  const renderAddressInfo = () => {
    const fullAddress = [
      family.address,
      family.city,
      family.state,
      family.zipCode
    ].filter(Boolean).join(', ');

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {fullAddress ? (
            <Badge
              variant="outline"
              className="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 cursor-pointer py-2 px-2 h-auto max-w-full"
              onClick={(e) => {
                e.stopPropagation();
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
                window.open(mapsUrl, '_blank');
              }}
              title="Click to open in Google Maps"
            >
              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{fullAddress}</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-muted-foreground">
              <MapPin className="h-3 w-3 mr-1" />
              No address
            </Badge>
          )}
        </div>

        {fullAddress && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleCopyAddress(fullAddress)}
            className="text-primary hover:text-primary/80 h-8"
            title="Copy address"
          >
            <Copy className="w-4 h-4 mr-1" />Copy Address
          </Button>
        )}
      </div>
    );
  };

  const renderChildrenInfo = () => {
    const children = family.members.filter(m => m.relationship === 'child');

    if (children.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {children.map((child: any, index: number) => (
          <div key={child.id || index} className="bg-white border border-green-200 rounded-lg px-3 py-2 text-sm shadow-sm">
            <div
              className="font-medium flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                onToggleGradeGroup(child.id || `${family.id}-${index}`);
              }}
            >
              <span className="cursor-pointer hover:text-blue-600 transition-colors text-sm font-medium">
                {child.koreanName && child.englishName
                  ? `${child.koreanName} (${child.englishName})`
                  : child.koreanName || child.englishName
                }
              </span>
              {child.gradeLevel && (
                <div className="relative">
                  <Badge className="bg-green-50 text-green-700 border-green-200">
                    <GraduationCap className="w-3 h-3" />
                  </Badge>
                  <div className="absolute -top-1 -right-1 h-4 w-4 border border-green-200 text-green-700 text-xs rounded-full flex items-center justify-center font-medium bg-white">
                   {`${getGradeGroupFirstChar(child.gradeLevel) || (index + 1)}${child.gradeLevel}`}
                  </div>
                </div>
              )}
              {child.gradeGroup && expandedGradeGroups.has(child.id || `${family.id}-${index}`) && (
                <span className={`flex items-center gap-1 text-xs ${
                  child.gradeGroup.toLowerCase().includes('team')
                    ? 'text-purple-600'
                    : child.gradeGroup.toLowerCase().includes('kid')
                    ? 'text-orange-600'
                    : child.gradeGroup.toLowerCase().includes('high')
                    ? 'text-indigo-600'
                    : child.gradeGroup.toLowerCase().includes('youth')
                    ? 'text-red-600'
                    : 'text-blue-600'
                }`}>
                  <Info className={`h-2.5 w-2.5 ${
                    child.gradeGroup.toLowerCase().includes('team')
                      ? 'text-purple-600'
                      : child.gradeGroup.toLowerCase().includes('kid')
                      ? 'text-orange-600'
                      : child.gradeGroup.toLowerCase().includes('high')
                      ? 'text-indigo-600'
                      : child.gradeGroup.toLowerCase().includes('youth')
                      ? 'text-red-600'
                      : 'text-blue-600'
                  }`} />
                  ({child.gradeGroup})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCoursesInfo = () => {
    const coursesInfo = getPrimaryCourses(family);

    if (!coursesInfo || coursesInfo.courses.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {coursesInfo.courses.map((courseValue, index) => {
          const courseOption = COURSE_OPTIONS.find(opt => opt.value === courseValue);
          const courseLabel = courseOption ? courseOption.label : courseValue;

          return (
            <Badge
              key={`${courseValue}-${index}`}
              variant="default"
              className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"
            >
              {courseLabel}
            </Badge>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`${styles.expandedContent} px-6 py-4`}>
      <Tabs defaultValue="current-info" className="w-full h-full">
        {/* Header with tabs and edit button */}
        <div className="flex justify-between items-center gap-4 mb-4">
          <TabsList className="grid grid-cols-2 w-80">
            <TabsTrigger value="current-info">기본정보</TabsTrigger>
            <TabsTrigger value="care-logs">
              <CareLogTabTitle familyId={family.id} />
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="h-8"
              title="Close"
            >
              <X className="w-4 h-4 mr-1" />
              Close
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/family/${family.id}/edit`);
              }}
              data-testid={`button-edit-${family.id}`}
              className="px-4 py-1 h-8 bg-blue-500 hover:bg-blue-600 text-white"
              title="Edit family"
            >
              <Edit className="w-4 h-4 mr-1" />Edit
            </Button>
          </div>
        </div>

        <TabsContent value="current-info" className="mt-0 flex-1">
          {/* Full-width desktop layout */}
          <div className="grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-3 gap-8 h-full">
            {/* Left column: Family picture - larger and more prominent */}
            <div className="xl:col-span-1 lg:col-span-1">
              <div className="flex flex-col items-center lg:items-start space-y-4">
                <div className="relative">
                  {family.familyPicture ? (
                    <div
                      className="relative cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onImageClick(family.familyPicture!, `${family.familyName} family`);
                      }}
                    >
                      <img
                        src={family.familyPicture}
                        alt={`${family.familyName} family`}
                        className={`w-56 h-56 object-cover rounded-2xl border-4 ${getStatusBorderClassName(family.memberStatus)} shadow-xl`}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.parentElement?.parentElement?.querySelector('.expanded-fallback-icon') as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="absolute top-3 right-3 bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-all">
                        <Search className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className={`w-56 h-56 rounded-2xl border-4 ${getStatusBorderClassName(family.memberStatus)} shadow-xl bg-gray-100 flex items-center justify-center`}>
                      <Users className="w-24 h-24 text-muted-foreground" />
                    </div>
                  )}
                  <div className="expanded-fallback-icon hidden w-56 h-56 rounded-2xl border-4 border-gray-300 shadow-xl bg-gray-100 items-center justify-center">
                    <Users className="w-24 h-24 text-muted-foreground" />
                  </div>
                </div>

                {/* Family name and status below picture */}
                <div className="text-center lg:text-left">
                  <h2 className="text-xl font-bold text-gray-900">{family.familyName}</h2>
                  <p className="text-sm text-gray-600 mt-1">Family ID: {family.id.slice(-8)}</p>
                </div>
              </div>
            </div>

            {/* Right columns: Contact information in organized sections */}
            <div className="xl:col-span-3 lg:col-span-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                {/* Contact Information Section */}
                <div className="bg-gray-50 rounded-xl p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Phone className="w-5 h-5 mr-2 text-blue-600" />
                    Contact Information
                  </h3>
                  <div className="space-y-4">
                    {renderContactInfo()}
                    {renderAddressInfo()}
                  </div>
                </div>

                {/* Children and Courses Combined Section */}
                <div className="space-y-6">
                  {/* Children Information Section */}
                  {family.members.filter(m => m.relationship === 'child').length > 0 && (
                    <div className="bg-green-50 rounded-xl p-6 shadow-sm border border-green-200">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <Users className="w-5 h-5 mr-2 text-green-600" />
                        Children ({family.members.filter(m => m.relationship === 'child').length})
                      </h3>
                      {renderChildrenInfo()}
                    </div>
                  )}

                  {/* Courses Information Section */}
                  {getPrimaryCourses(family)?.courses.length && (
                    <div className="bg-blue-50 rounded-xl p-6 shadow-sm border border-blue-200">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <GraduationCap className="w-5 h-5 mr-2 text-blue-600" />
                        Courses ({getPrimaryCourses(family)?.courses.length})
                      </h3>
                      {renderCoursesInfo()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="staff-notes" className="mt-0 flex-1">
          <div className="p-8 border border-dashed border-gray-300 rounded-xl text-center text-muted-foreground h-full flex flex-col justify-center">
            <p className="text-lg">Staff notes functionality will be implemented later.</p>
            <p className="text-sm mt-2">This will include internal staff communications and follow-up actions.</p>
          </div>
        </TabsContent>

        <TabsContent value="care-logs" className="mt-0 flex-1">
          <div className="h-full">
            <CareLogList familyId={family.id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}