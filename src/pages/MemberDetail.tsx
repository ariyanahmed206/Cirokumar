import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  GraduationCap,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  UserCheck,
} from 'lucide-react';
import { MemberAvatar } from '../components/MemberAvatar';
import { api } from '../lib/api';
import { Link } from '../lib/router';
import type { Member } from '../types';

export function MemberDetail({ id }: { id: number }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api
      .getMember(id)
      .then(setMember)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (notFound || !member) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-14 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <p className="text-slate-600 mb-4">সদস্যের তথ্য পাওয়া যায়নি।</p>
          <Link
            href="/members"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            সদস্য তালিকায় ফিরুন
          </Link>
        </div>
      </div>
    );
  }

  const showPhoto = Boolean(member.photoUrl && member.photoVisibility === 'show');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/members"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          ফিরে যান
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6">
          {showPhoto && (
            <div className="h-56 sm:h-64 bg-slate-100 overflow-hidden">
              <img
                src={member.photoUrl!}
                alt={member.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 sm:p-8 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">{member.name}</h1>
              <p className="text-blue-100 text-sm sm:text-base tabular-nums">
                সদস্য নং: {member.memberNumber}
              </p>
            </div>
            <MemberAvatar
              name={member.name}
              photoUrl={member.photoUrl}
              photoVisibility={member.photoVisibility}
              size="lg"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="flex items-start gap-3">
            <UserCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-500">বয়স</p>
              <p className="text-slate-800 tabular-nums">{member.age} বছর</p>
            </div>
          </div>

          {member.profession && (
            <div className="flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-500">পেশা</p>
                <p className="text-slate-800">{member.profession}</p>
              </div>
            </div>
          )}

          {member.area && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-500">এলাকা</p>
                <p className="text-slate-800">{member.area}</p>
              </div>
            </div>
          )}

          {member.education && (
            <div className="flex items-start gap-3">
              <GraduationCap className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-500">শিক্ষাগত যোগ্যতা</p>
                <p className="text-slate-800">{member.education}</p>
              </div>
            </div>
          )}

          {member.hobbies && (
            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-500">শখ</p>
                <p className="text-slate-800">{member.hobbies}</p>
              </div>
            </div>
          )}

          {member.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-500">ফোন নম্বর</p>
                <p className="text-slate-800 tabular-nums">{member.phone}</p>
              </div>
            </div>
          )}

          {member.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-500">ইমেইল</p>
                <p className="text-slate-800">{member.email}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-500">যোগদানের তারিখ</p>
              <p className="text-slate-800">
                {new Date(member.joinDate).toLocaleDateString('bn-BD', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {member.about && (
            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-1.5">সদস্যের সম্পর্কে</p>
              <p className="text-slate-700 leading-relaxed">{member.about}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
